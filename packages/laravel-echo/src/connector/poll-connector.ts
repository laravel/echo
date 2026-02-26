import {
    PollChannel,
    PollPresenceChannel,
    PollPrivateChannel,
} from "../channel";
import type { ConnectionStatus } from "../echo";
import { Connector, type EchoOptionsWithDefaults } from "./connector";

type AnyPollChannel = PollChannel | PollPrivateChannel | PollPresenceChannel;

export type PollOptions = EchoOptionsWithDefaults<"poll"> & {
    pollInterval?: number;
    pollEndpoint?: string;
};

/**
 * This class creates a connector that polls a Laravel backend.
 */
export class PollConnector extends Connector<
    "poll",
    PollChannel,
    PollPrivateChannel,
    PollPresenceChannel
> {
    /**
     * All of the subscribed channel names.
     */
    channels!: Record<string, AnyPollChannel>;

    declare options: PollOptions;

    /**
     * The polling interval timer.
     */
    private pollTimer!: ReturnType<typeof setInterval> | null;

    /**
     * Cursor for event-sourcing.
     */
    private lastEventId!: string | null;

    /**
     * A unique socket ID for this client.
     */
    private _socketId!: string;

    /**
     * Current connection status.
     */
    private status!: ConnectionStatus;

    /**
     * Connection status change subscribers.
     */
    private statusCallbacks!: Set<(status: ConnectionStatus) => void>;

    /**
     * Whether a poll request is currently in flight.
     */
    private polling!: boolean;

    /**
     * Create a fresh connection.
     *
     * Note: All fields are initialized here rather than as field initializers
     * because the parent Connector constructor calls connect() before
     * subclass field initializers run.
     */
    connect(): void {
        this.channels = {};
        this.pollTimer = null;
        this.lastEventId = null;
        this.status = "connecting";
        this.statusCallbacks = new Set();
        this.polling = false;
        this._socketId = `${Math.random().toString(36).substring(2)}.${Math.random().toString(36).substring(2)}`;
        this.startPolling();
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(
        name: string,
        event: string,
        callback: CallableFunction,
    ): AnyPollChannel {
        return this.channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     */
    channel(name: string): PollChannel {
        if (!this.channels[name]) {
            this.channels[name] = new PollChannel(name, this.options);
        }
        return this.channels[name] as PollChannel;
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): PollPrivateChannel {
        const prefixed = "private-" + name;
        if (!this.channels[prefixed]) {
            this.channels[prefixed] = new PollPrivateChannel(
                prefixed,
                this.options,
            );
        }
        return this.channels[prefixed] as PollPrivateChannel;
    }

    /**
     * Get a presence channel instance by name.
     */
    presenceChannel(name: string): PollPresenceChannel {
        const prefixed = "presence-" + name;
        if (!this.channels[prefixed]) {
            this.channels[prefixed] = new PollPresenceChannel(
                prefixed,
                this.options,
            );
        }
        return this.channels[prefixed] as PollPresenceChannel;
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void {
        [
            name,
            "private-" + name,
            "private-encrypted-" + name,
            "presence-" + name,
        ].forEach((n) => this.leaveChannel(n));
    }

    /**
     * Leave the given channel.
     */
    leaveChannel(name: string): void {
        if (this.channels[name]) {
            this.channels[name].unsubscribe();
            delete this.channels[name];
        }
    }

    /**
     * Get the socket ID for the connection.
     */
    socketId(): string | undefined {
        return this._socketId;
    }

    /**
     * Get the current connection status.
     */
    connectionStatus(): ConnectionStatus {
        return this.status;
    }

    /**
     * Subscribe to connection status changes.
     */
    onConnectionChange(
        callback: (status: ConnectionStatus) => void,
    ): () => void {
        this.statusCallbacks.add(callback);
        return () => {
            this.statusCallbacks.delete(callback);
        };
    }

    /**
     * Disconnect from the Echo server.
     */
    disconnect(): void {
        this.stopPolling();
        this.setStatus("disconnected");
        Object.keys(this.channels).forEach((name) => {
            this.channels[name].unsubscribe();
        });
        this.channels = {};
        this.lastEventId = null;
    }

    /**
     * Set the connection status and notify subscribers.
     */
    private setStatus(status: ConnectionStatus): void {
        if (this.status !== status) {
            this.status = status;
            this.statusCallbacks.forEach((cb) => cb(status));
        }
    }

    /**
     * Start the polling loop.
     */
    private startPolling(): void {
        const interval = this.options.pollInterval ?? 5000;

        this.poll();

        this.pollTimer = setInterval(() => {
            this.poll();
        }, interval);
    }

    /**
     * Stop the polling loop.
     */
    private stopPolling(): void {
        if (this.pollTimer !== null) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    /**
     * Perform a single poll request.
     */
    private async poll(): Promise<void> {
        if (this.polling) {
            return;
        }

        const channelNames = Object.keys(this.channels);

        if (channelNames.length === 0) {
            return;
        }

        this.polling = true;

        try {
            const endpoint =
                this.options.pollEndpoint ?? "/broadcasting/poll";

            const body: Record<string, any> = {
                channels: channelNames,
            };
            if (this.lastEventId) {
                body.lastEventId = this.lastEventId;
            }

            const headers: Record<string, string> = {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Socket-ID": this._socketId,
                ...this.options.auth.headers,
            };

            const response = await fetch(endpoint, {
                method: "POST",
                headers,
                credentials: "same-origin",
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error(`Poll request failed: ${response.status}`);
            }

            const data = await response.json();

            if (data.lastEventId) {
                this.lastEventId = data.lastEventId;
            }

            if (this.status !== "connected") {
                this.setStatus("connected");
                Object.values(this.channels).forEach((channel) => {
                    (channel as PollChannel).notifySubscribed();
                });
            }

            if (data.events && Array.isArray(data.events)) {
                for (const event of data.events) {
                    const ch = this.channels[event.channel];
                    if (ch) {
                        (ch as PollChannel).dispatch(event.event, event.data);
                    }
                }
            }

            if (data.presence) {
                for (const [channelName, presenceData] of Object.entries(
                    data.presence,
                )) {
                    const ch = this.channels[channelName];
                    if (ch && ch instanceof PollPresenceChannel) {
                        ch.updatePresence(
                            presenceData as { members: any[] },
                        );
                    }
                }
            }
        } catch (error) {
            Object.values(this.channels).forEach((channel) => {
                (channel as PollChannel).notifyError(error);
            });

            if (this.status === "connected") {
                this.setStatus("reconnecting");
            } else if (this.status !== "reconnecting") {
                this.setStatus("failed");
            }
        } finally {
            this.polling = false;
        }
    }
}
