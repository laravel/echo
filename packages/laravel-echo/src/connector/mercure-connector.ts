import {
    MercureChannel,
    MercureEncryptedPrivateChannel,
    MercurePresenceChannel,
    MercurePrivateChannel,
} from "../channel";
import type { ConnectionStatus } from "../echo";
import { Connector } from "./connector";

type AnyMercureChannel =
    | MercureChannel
    | MercurePrivateChannel
    | MercureEncryptedPrivateChannel
    | MercurePresenceChannel;

/** Mercure-specific connector options. */
export type MercureOptions = {
    /** The hub URL, defaulting to the well-known path in browsers. */
    host?: string | null;

    /** The EventSource implementation, required when none exists globally. */
    eventSource?: typeof EventSource;
};

/** The default Mercure hub path. */
const DEFAULT_HUB_PATH = "/.well-known/mercure";

/** The maximum reconnect delay. */
const MAX_RECONNECT_DELAY = 30000;

/** The server-side channel limit for a batch auth request. */
const MAX_CHANNELS = 100;

/** The event type for hub-generated subscription updates. */
const SUBSCRIPTION_EVENT_TYPE = "mercure";

/** The prefix for encrypted channels. */
const ENCRYPTED_PREFIX = "private-encrypted-";

/** The wire prefix for client events. */
const WHISPER_EVENT_PREFIX = "client-";

/**
 * Connects Echo to Mercure using one shared stream plus isolated whisper streams.
 * Whisper channels are bound to exact topics because their envelopes are untrusted;
 * client event payloads are peer-generated and must not be treated as server truth.
 */
export class MercureConnector extends Connector<
    "mercure",
    MercureChannel,
    MercurePrivateChannel,
    MercurePresenceChannel
> {
    /** Subscribed channels keyed by full name. */
    channels: Record<string, AnyMercureChannel> = Object.create(null) as Record<
        string,
        AnyMercureChannel
    >;

    /** Assigned by connect() during the base constructor before field initialization. */
    declare private url: URL;

    /** The EventSource for the current topic set. */
    private eventSource: EventSource | null = null;

    /** The last SSE id used to resume after reconnecting. */
    private lastEventId = "";

    /** Whisper streams keyed by guarded channel. */
    private whisperEventSources = new Map<string, EventSource>();

    /** Per-channel whisper replay cursors. */
    private whisperLastEventIds = new Map<string, string>();

    /** Channels that have opened a whisper stream. */
    private whisperListening = new Set<string>();

    /** Whether the server grants client events. */
    private clientEventsEnabled = false;

    /** The server-provided topic namespace. */
    private topicPrefix = "";

    /** Serializes outgoing whispers. */
    private whisperQueue: Promise<void> = Promise.resolve();

    /** The local connection id used by toOthers(). */
    private id: string = randomId();

    /** The current connection status. */
    private status: ConnectionStatus = "disconnected";

    /** Connection status listeners. */
    private statusListeners: Array<(status: ConnectionStatus) => void> = [];

    /** Whether a connection refresh is running. */
    private refreshing = false;

    /** Whether another refresh is needed after the current one. */
    private refreshPending = false;

    /** The last authorized set, used to identify newcomers in rejected batches. */
    private authorizedChannels = new Set<string>();

    /** Channels whose subscribed callbacks have fired. */
    private subscribedNotified = new Set<string>();

    /** Presence channels with an initial snapshot. */
    private seededPresenceChannels = new Set<string>();

    /** Presence events buffered until the initial snapshot arrives. */
    private pendingSubscriptionEvents = new Map<
        string,
        Array<[string, boolean, unknown]>
    >();

    /** Decryption keys returned by the auth endpoint. */
    private channelJwks = new Map<string, JsonWebKey>();

    /** Imported WebCrypto keys cached by channel. */
    private importedKeys = new Map<
        string,
        { k: string; key: Promise<CryptoKey> }
    >();

    /** Serializes encrypted dispatches to preserve event order. */
    private dispatchQueue: Promise<void> = Promise.resolve();

    /** Prevents an in-flight refresh from reconnecting after disconnect(). */
    private epoch = 0;

    /** The exponential reconnect delay. */
    private reconnectDelay = 1000;

    /** The pending reconnect timer. */
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    /** The server-reported subscriber cookie lifetime. */
    private tokenTtl: number | null = null;

    /** When the subscriber cookie was last minted. */
    private lastAuthAt = 0;

    /** Refreshes the httpOnly subscriber cookie before its reported expiry. */
    private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

    /** Runs from the base constructor and must not access subclass fields. */
    connect(): void {
        const inBrowser = typeof window !== "undefined";

        if (this.options.host == null && !inBrowser) {
            throw new Error(
                'Mercure connector: the "host" option (the hub URL) is required outside a browser.',
            );
        }

        try {
            // Resolve relative hub paths against the page...
            this.url = new URL(
                this.options.host ?? DEFAULT_HUB_PATH,
                inBrowser ? window.location.origin : undefined,
            );
        } catch {
            throw new Error(
                `Mercure connector: the "host" option ("${String(this.options.host)}") is not a valid hub URL.`,
            );
        }
    }

    /** Get the configured EventSource implementation. */
    private eventSourceClass(): typeof EventSource {
        const implementation =
            (this.options as MercureOptions).eventSource ??
            globalThis.EventSource;

        if (implementation === undefined) {
            throw new Error(
                'Mercure connector: EventSource is not available globally; pass an implementation via the "eventSource" option.',
            );
        }

        return implementation;
    }

    /** Get the subscription API path for this hub. */
    private subscriptionsPath(): string {
        return `${this.url.pathname.replace(/\/$/, "")}/subscriptions`;
    }

    /** Get the hub topic for a channel. */
    private channelTopic(name: string): string {
        return this.topicPrefix === ""
            ? name
            : `${this.topicPrefix}channel/${encodeChannelName(name)}`;
    }

    /** Get the publishable whisper topic for a channel. */
    private whisperTopic(name: string): string {
        return `${this.topicPrefix}whisper/${encodeChannelName(name)}`;
    }

    /** Map an exact hub topic back to its channel name. */
    private channelNameFromTopic(topic: string): string | null {
        if (this.topicPrefix === "") {
            return topic;
        }

        const namespace = `${this.topicPrefix}channel/`;

        if (!topic.startsWith(namespace)) {
            return null;
        }

        try {
            return decodeURIComponent(topic.slice(namespace.length));
        } catch {
            return null;
        }
    }

    /** Listen for an event on a channel. */
    listen(
        name: string,
        event: string,
        callback: CallableFunction,
    ): AnyMercureChannel {
        return this.channel(name).listen(event, callback);
    }

    /** Get a public channel. */
    channel(name: string): MercureChannel {
        if (!this.channels[name]) {
            this.channels[name] = new MercureChannel(name, this.options, this);
            this.refresh();
        }

        return this.channels[name];
    }

    /** Get a private channel. */
    privateChannel(name: string): MercurePrivateChannel {
        const fullName = "private-" + name;

        if (!this.channels[fullName]) {
            this.channels[fullName] = new MercurePrivateChannel(
                fullName,
                this.options,
                this,
            );
            this.refresh();
        }

        return this.channels[fullName];
    }

    /** Get an encrypted private channel. */
    encryptedPrivateChannel(name: string): MercureEncryptedPrivateChannel {
        const fullName = ENCRYPTED_PREFIX + name;

        if (!this.channels[fullName]) {
            this.channels[fullName] = new MercureEncryptedPrivateChannel(
                fullName,
                this.options,
                this,
            );
            this.refresh();
        }

        return this.channels[fullName];
    }

    /** Get a presence channel. */
    presenceChannel(name: string): MercurePresenceChannel {
        const fullName = "presence-" + name;

        if (!this.channels[fullName]) {
            this.channels[fullName] = new MercurePresenceChannel(
                fullName,
                this.options,
                this,
            );
            this.refresh();
        }

        return this.channels[fullName] as MercurePresenceChannel;
    }

    /** Leave all variants of a channel. */
    leave(name: string): void {
        ["", "private-", ENCRYPTED_PREFIX, "presence-"].forEach((prefix) =>
            this.leaveChannel(prefix + name),
        );
    }

    /** Leave a channel by its full name. */
    leaveChannel(name: string): void {
        if (this.channels[name]) {
            delete this.channels[name];
            this.forgetChannelState(name);
            this.refresh();
        }
    }

    /** Get the connection id. */
    socketId(): string {
        return this.id;
    }

    /** Queue a whisper for direct publication to the hub. */
    whisper(name: string, event: string, data: unknown): void {
        const channel = this.channels[name];

        if (!channel) {
            return;
        }

        if (!this.clientEventsEnabled) {
            channel.notifyError(
                new Error(
                    `whisper("${event}"): the server did not grant client events; enable the "client_events" option of the Mercure broadcasting connection.`,
                ),
            );

            return;
        }

        this.whisperQueue = this.whisperQueue.then(() =>
            this.publishWhisper(name, WHISPER_EVENT_PREFIX + event, data).catch(
                (error: unknown) => {
                    this.channels[name]?.notifyError(error);
                },
            ),
        );
    }

    /** Open a whisper stream when the channel is authorized. */
    listenForWhispers(name: string): void {
        if (this.whisperListening.has(name) || !this.channels[name]) {
            return;
        }

        this.whisperListening.add(name);
        this.syncWhisperEventSources();
    }

    /** Publish a whisper, re-authenticating once after a 401 response. */
    private async publishWhisper(
        name: string,
        wireEvent: string,
        data: unknown,
    ): Promise<void> {
        let updateData: string;

        if (name.startsWith(ENCRYPTED_PREFIX)) {
            updateData = JSON.stringify({
                channels: [name],
                data: await this.encrypt(
                    name,
                    JSON.stringify({
                        event: wireEvent,
                        payload: data,
                        socket: this.id,
                    }),
                ),
            });
        } else {
            updateData = JSON.stringify({
                channels: [name],
                event: wireEvent,
                payload: data,
                socket: this.id,
            });
        }

        const publish = () =>
            fetch(`${this.url.origin}${this.url.pathname}`, {
                method: "POST",
                credentials: "include",
                // URLSearchParams keeps this a simple request without CORS preflight...
                body: new URLSearchParams({
                    topic: this.whisperTopic(name),
                    data: updateData,
                    private: "on",
                }),
            });

        let response = await publish();

        if (response.status === 401 && this.channels[name]) {
            const auth = await this.authenticate(Object.keys(this.channels));

            if (auth.ok) {
                if (auth.denied.length > 0) {
                    this.evict(
                        auth.denied,
                        new Error(
                            `The broadcasting auth request denied access to [${auth.denied.join(", ")}].`,
                        ),
                    );
                    this.refresh();
                }

                if (this.channels[name]) {
                    response = await publish();
                }
            }
        }

        if (!response.ok) {
            throw new Error(
                `The whisper publish on "${name}" failed with HTTP ${response.status}.`,
            );
        }
    }

    /** Get the current connection status. */
    connectionStatus(): ConnectionStatus {
        return this.status;
    }

    /** Subscribe to connection status changes. */
    onConnectionChange(
        callback: (status: ConnectionStatus) => void,
    ): () => void {
        this.statusListeners.push(callback);

        return () => {
            this.statusListeners = this.statusListeners.filter(
                (registered) => registered !== callback,
            );
        };
    }

    /** Disconnect from Mercure. */
    disconnect(): void {
        this.epoch++; // strands any in-flight refresh (see doRefresh)...
        this.channels = Object.create(null) as Record<
            string,
            AnyMercureChannel
        >;
        this.authorizedChannels.clear();
        this.subscribedNotified.clear();
        this.seededPresenceChannels.clear();
        this.pendingSubscriptionEvents.clear();
        this.channelJwks.clear();
        this.importedKeys.clear();
        this.lastEventId = "";
        this.whisperLastEventIds.clear();
        this.whisperListening.clear();
        this.clientEventsEnabled = false;
        this.topicPrefix = "";

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectDelay = 1000;

        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
            this.tokenRefreshTimer = null;
        }

        this.eventSource?.close();
        this.eventSource = null;
        this.closeWhisperEventSources();
        this.setStatus("disconnected");
    }

    /** Update the connection status. */
    private setStatus(status: ConnectionStatus): void {
        this.status = status;
        this.statusListeners.forEach((callback) => callback(status));
    }

    /** Forget all connector state for a channel. */
    private forgetChannelState(name: string): void {
        this.authorizedChannels.delete(name);
        this.subscribedNotified.delete(name);
        this.seededPresenceChannels.delete(name);
        this.pendingSubscriptionEvents.delete(name);
        this.channelJwks.delete(name);
        this.importedKeys.delete(name);
        this.whisperEventSources.get(name)?.close();
        this.whisperEventSources.delete(name);
        this.whisperLastEventIds.delete(name);
        this.whisperListening.delete(name);
    }

    /** Evict channels and report the error to each one. */
    private evict(names: string[], error: Error): void {
        names.forEach((name) => {
            const channel = this.channels[name];

            if (!channel) {
                return;
            }

            delete this.channels[name];
            this.forgetChannelState(name);
            channel.notifyError(error);
        });
    }

    /** Notify every channel of an error. */
    private notifyAllError(error: unknown): void {
        Object.values(this.channels).forEach((channel) =>
            channel.notifyError(error),
        );
    }

    /** Match guarded channels by the same prefixes used by the server. */
    private guardedChannelNames(): string[] {
        return Object.keys(this.channels).filter(
            (name) =>
                name.startsWith("private-") || name.startsWith("presence-"),
        );
    }

    /** Refresh the shared stream, coalescing concurrent requests. */
    private refresh(): void {
        this.runExclusive(() => this.doRefresh());
    }

    /** Run refresh work exclusively and retry failures with backoff. */
    private runExclusive(work: () => Promise<void>): void {
        if (this.refreshing) {
            this.refreshPending = true;

            return;
        }

        this.refreshing = true;

        void work()
            .catch((error) => {
                // Surface callback failures without stranding the connection...
                this.notifyAllError(error);

                if (Object.keys(this.channels).length > 0) {
                    this.setStatus("reconnecting");
                    this.scheduleReconnect();
                }
            })
            .finally(() => {
                this.refreshing = false;

                if (this.refreshPending) {
                    this.refreshPending = false;
                    this.refresh();
                }
            });
    }

    /** Refresh the subscriber cookie before its reported expiry. */
    private scheduleTokenRefresh(): void {
        if (this.tokenTtl === null) {
            return;
        }

        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
        }

        const epoch = this.epoch;

        this.tokenRefreshTimer = setTimeout(
            () => {
                this.tokenRefreshTimer = null;

                if (
                    epoch !== this.epoch ||
                    Object.keys(this.channels).length === 0
                ) {
                    return;
                }

                // Rebuild if a delayed timer allowed the cookie to expire...
                if (
                    this.tokenTtl !== null &&
                    Date.now() - this.lastAuthAt >= this.tokenTtl * 1000
                ) {
                    this.refresh();

                    return;
                }

                this.runExclusive(async () => {
                    const auth = await this.authenticate(
                        Object.keys(this.channels),
                    );

                    if (epoch !== this.epoch) {
                        return;
                    }

                    if (auth.ok) {
                        // Rebuild without channels revoked mid-session...
                        if (auth.denied.length > 0) {
                            this.evict(
                                auth.denied,
                                new Error(
                                    `The broadcasting auth request denied access to [${auth.denied.join(", ")}].`,
                                ),
                            );
                            this.refresh();
                        }

                        this.scheduleTokenRefresh();
                    } else {
                        // Retry before the hub drops the expired connection...
                        this.notifyAllError(auth.error);
                        this.scheduleReconnect();
                    }
                });
            },
            Math.max(this.tokenTtl * 0.8 * 1000, 5000),
        );
    }

    /** Schedule a full reconnect with exponential backoff. */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            return;
        }

        const epoch = this.epoch;

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;

            if (
                epoch !== this.epoch ||
                Object.keys(this.channels).length === 0
            ) {
                return;
            }

            this.refresh();
        }, this.reconnectDelay);

        this.reconnectDelay = Math.min(
            this.reconnectDelay * 2,
            MAX_RECONNECT_DELAY,
        );
    }

    private async doRefresh(): Promise<void> {
        const epoch = this.epoch;

        // Coalesce same-tick joins and leaves into one auth request...
        await Promise.resolve();

        if (epoch !== this.epoch) {
            return;
        }

        this.refreshPending = false;

        let channelNames = Object.keys(this.channels);

        if (channelNames.length === 0) {
            this.eventSource?.close();
            this.eventSource = null;
            this.closeWhisperEventSources();
            this.authorizedChannels.clear();
            this.setStatus("disconnected");

            return;
        }

        if (channelNames.length > MAX_CHANNELS) {
            this.evict(
                channelNames.slice(MAX_CHANNELS),
                new Error(
                    `Mercure broadcasting authorizes at most ${MAX_CHANNELS} channels per connection.`,
                ),
            );
            channelNames = channelNames.slice(0, MAX_CHANNELS);
        }

        if (!this.eventSource) {
            this.setStatus("connecting");
        }

        // Keep the previous stream alive until authentication succeeds...
        const auth = await this.authenticate(channelNames);

        if (epoch !== this.epoch) {
            return;
        }

        if (!auth.ok) {
            const newcomers = channelNames.filter(
                (name) =>
                    !this.authorizedChannels.has(name) && this.channels[name],
            );

            // A rejected batch evicts only its newly joined channels...
            if (auth.rejected && newcomers.length > 0) {
                this.evict(
                    newcomers,
                    new Error(
                        `The broadcasting auth request was denied (HTTP ${String(auth.status)}) after joining [${newcomers.join(", ")}].`,
                    ),
                );
                this.refreshPending = true;

                return;
            }

            // Keep the current stream alive while retrying transient failures...
            this.notifyAllError(auth.error);
            this.setStatus("reconnecting");
            this.scheduleReconnect();

            return;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Continue with the granted subset after individual denials...
        if (auth.denied.length > 0) {
            this.evict(
                auth.denied,
                new Error(
                    `The broadcasting auth request denied access to [${auth.denied.join(", ")}].`,
                ),
            );

            channelNames = channelNames.filter((name) => this.channels[name]);

            if (channelNames.length === 0) {
                this.eventSource?.close();
                this.eventSource = null;
                this.closeWhisperEventSources();
                this.authorizedChannels.clear();
                this.setStatus("disconnected");

                return;
            }
        }

        this.authorizedChannels = new Set(channelNames);
        this.scheduleTokenRefresh();

        // Buffer live presence events before fetching initial snapshots...
        channelNames
            .filter(
                (name) =>
                    this.channels[name] instanceof MercurePresenceChannel &&
                    !this.seededPresenceChannels.has(name) &&
                    !this.pendingSubscriptionEvents.has(name),
            )
            .forEach((name) => this.pendingSubscriptionEvents.set(name, []));

        const url = this.buildSubscribeUrl(
            channelNames.map((name) => this.channelTopic(name)),
            channelNames
                .filter(
                    (name) =>
                        this.channels[name] instanceof MercurePresenceChannel,
                )
                .map((name) => this.subscriptionEventsPattern(name)),
            this.lastEventId,
        );

        const EventSourceImplementation = this.eventSourceClass();

        this.eventSource?.close();

        const eventSource = new EventSourceImplementation(url.toString(), {
            withCredentials: true,
        });

        this.eventSource = eventSource;

        eventSource.onopen = () => {
            if (this.eventSource !== eventSource) {
                return;
            }

            this.reconnectDelay = 1000;
            this.setStatus("connected");

            channelNames.forEach((name) => {
                const channel = this.channels[name];

                if (channel && !this.subscribedNotified.has(name)) {
                    this.subscribedNotified.add(name);
                    channel.notifySubscribed();
                }
            });

            // Fetch after opening so the snapshot includes this subscriber...
            void this.seedPresenceChannels(epoch);
        };

        eventSource.onerror = (event) => {
            if (this.eventSource !== eventSource) {
                return;
            }

            this.notifyAllError(event);

            this.setStatus("reconnecting");

            if (eventSource.readyState === EventSourceImplementation.CLOSED) {
                // A terminal stream needs fresh auth, presence, and subscriptions...
                this.subscribedNotified.clear();
                this.seededPresenceChannels.clear();
                this.pendingSubscriptionEvents.clear();
                this.scheduleReconnect();
            }
        };

        eventSource.onmessage = (event: MessageEvent) => {
            if (this.eventSource === eventSource) {
                this.handleMessage(event);
            }
        };

        eventSource.addEventListener(SUBSCRIPTION_EVENT_TYPE, (event) => {
            if (this.eventSource === eventSource) {
                this.handleSubscriptionEvent(event);
            }
        });

        this.syncWhisperEventSources();
    }

    /** Build a fresh hub subscription URL. */
    private buildSubscribeUrl(
        matches: string[],
        urlPatterns: string[],
        lastEventId: string,
    ): URL {
        const url = new URL(this.url);

        url.search = "";
        matches.forEach((match) => url.searchParams.append("match", match));
        urlPatterns.forEach((pattern) =>
            url.searchParams.append("match_urlpattern", pattern),
        );

        if (lastEventId) {
            url.searchParams.set("last_event_id", lastEventId);
        }

        return url;
    }

    /** Close whisper streams while retaining replay cursors. */
    private closeWhisperEventSources(): void {
        this.whisperEventSources.forEach((source) => source.close());
        this.whisperEventSources.clear();
    }

    /** Reconcile lazy whisper streams without replacing healthy ones. */
    private syncWhisperEventSources(): void {
        const CLOSED = this.eventSourceClass().CLOSED;

        const desired = new Set(
            this.clientEventsEnabled
                ? this.guardedChannelNames().filter(
                      (name) =>
                          this.authorizedChannels.has(name) &&
                          this.whisperListening.has(name),
                  )
                : [],
        );

        this.whisperEventSources.forEach((source, name) => {
            if (!desired.has(name) || source.readyState === CLOSED) {
                source.close();
                this.whisperEventSources.delete(name);
            }
        });

        if (!this.clientEventsEnabled) {
            this.whisperLastEventIds.clear();

            return;
        }

        desired.forEach((name) => {
            if (!this.whisperEventSources.has(name)) {
                this.openWhisperEventSource(name);
            }
        });
    }

    /** Open a channel's exact-topic whisper stream. */
    private openWhisperEventSource(name: string): void {
        const EventSourceImplementation = this.eventSourceClass();

        const eventSource = new EventSourceImplementation(
            this.buildSubscribeUrl(
                [this.whisperTopic(name)],
                [],
                this.whisperLastEventIds.get(name) ?? "",
            ).toString(),
            { withCredentials: true },
        );

        this.whisperEventSources.set(name, eventSource);

        eventSource.onmessage = (event: MessageEvent) => {
            if (this.whisperEventSources.get(name) !== eventSource) {
                return;
            }

            this.whisperLastEventIds.set(name, event.lastEventId);
            this.handleWhisperMessage(event, name);
        };

        eventSource.onerror = () => {
            if (
                this.whisperEventSources.get(name) === eventSource &&
                eventSource.readyState === EventSourceImplementation.CLOSED
            ) {
                this.scheduleReconnect();
            }
        };
    }

    /** Seed presence snapshots, then replay buffered live events. */
    private async seedPresenceChannels(epoch: number): Promise<void> {
        await Promise.all(
            [...this.pendingSubscriptionEvents.keys()].map(async (name) => {
                const channel = this.channels[name];

                if (!(channel instanceof MercurePresenceChannel)) {
                    this.pendingSubscriptionEvents.delete(name);

                    return;
                }

                try {
                    const members = await this.fetchPresenceSnapshot(name);

                    if (epoch !== this.epoch) {
                        return;
                    }

                    this.seededPresenceChannels.add(name);
                    channel.setInitialMembers(members);

                    (this.pendingSubscriptionEvents.get(name) ?? []).forEach(
                        ([subscriber, active, payload]) =>
                            channel.applySubscriptionEvent(
                                subscriber,
                                active,
                                payload,
                            ),
                    );
                } catch (error) {
                    // Report failure rather than faking an empty room...
                    channel.notifyError(error);
                } finally {
                    this.pendingSubscriptionEvents.delete(name);
                }
            }),
        );
    }

    /** Dispatch a regular broadcast envelope to its channels. */
    private handleMessage(event: MessageEvent): void {
        this.lastEventId = event.lastEventId;

        const message = parseJson<{
            channels?: unknown;
            event?: unknown;
            payload?: unknown;
            socket?: unknown;
            data?: unknown;
        }>(event.data as string);

        if (!message || !Array.isArray(message.channels)) {
            return;
        }

        const channels = message.channels.filter(
            (name): name is string => typeof name === "string",
        );

        // Queue encrypted dispatches to preserve event order...
        if (typeof message.data === "string") {
            const data = message.data;

            channels
                .filter(
                    (name) =>
                        name.startsWith(ENCRYPTED_PREFIX) &&
                        hasOwn(this.channels, name),
                )
                .forEach((name) => {
                    this.dispatchQueue = this.dispatchQueue.then(() =>
                        this.dispatchEncrypted(name, data),
                    );
                });

            return;
        }

        if (message.socket && message.socket === this.id) {
            return;
        }

        if (typeof message.event !== "string") {
            return;
        }

        channels.forEach((name) => {
            // Never dispatch plaintext to an encrypted channel...
            if (
                !name.startsWith(ENCRYPTED_PREFIX) &&
                hasOwn(this.channels, name)
            ) {
                this.channels[name].dispatch(
                    message.event as string,
                    message.payload,
                );
            }
        });
    }

    /** Dispatch only client events matching the trusted, stream-bound channel. */
    private handleWhisperMessage(event: MessageEvent, name: string): void {
        const message = parseJson<{
            channels?: unknown;
            event?: unknown;
            payload?: unknown;
            socket?: unknown;
            data?: unknown;
        }>(event.data as string);

        if (
            !message ||
            !Array.isArray(message.channels) ||
            message.channels.length !== 1 ||
            message.channels[0] !== name
        ) {
            return;
        }

        if (!hasOwn(this.channels, name)) {
            return;
        }

        if (typeof message.data === "string") {
            const data = message.data;

            if (name.startsWith(ENCRYPTED_PREFIX)) {
                this.dispatchQueue = this.dispatchQueue.then(() =>
                    this.dispatchEncrypted(name, data, true),
                );
            }

            return;
        }

        if (message.socket && message.socket === this.id) {
            return;
        }

        if (
            typeof message.event !== "string" ||
            !message.event.startsWith(WHISPER_EVENT_PREFIX) ||
            name.startsWith(ENCRYPTED_PREFIX)
        ) {
            return;
        }

        this.channels[name].dispatch(message.event, message.payload);
    }

    /** Decrypt and dispatch an update only after authenticating it. */
    private async dispatchEncrypted(
        name: string,
        serializedJwe: string,
        whisper = false,
    ): Promise<void> {
        const channel = this.channels[name];

        if (!channel) {
            return;
        }

        try {
            const plaintext = await this.decrypt(name, serializedJwe);
            const message = parseJson<{
                event?: unknown;
                payload?: unknown;
                socket?: unknown;
            }>(plaintext);

            if (!message || typeof message.event !== "string") {
                throw new Error(
                    `The decrypted update on "${name}" carries no broadcast envelope.`,
                );
            }

            // Channel members cannot inject server events through whispers...
            if (whisper && !message.event.startsWith(WHISPER_EVENT_PREFIX)) {
                return;
            }

            if (message.socket && message.socket === this.id) {
                return;
            }

            channel.dispatch(message.event, message.payload);
        } catch (error) {
            channel.notifyError(error);
        }
    }

    /** Decrypt a compact direct-encryption A256GCM JWE using its protected header as AAD. */
    private async decrypt(
        name: string,
        serializedJwe: string,
    ): Promise<string> {
        const segments = serializedJwe.split(".");

        if (segments.length !== 5 || segments[1] !== "") {
            throw new Error(
                `The update on "${name}" is not a direct-encryption compact JWE.`,
            );
        }

        const [protectedSegment, , ivSegment, ciphertextSegment, tagSegment] =
            segments;

        const header = parseJson<{ alg?: unknown; enc?: unknown }>(
            textDecoder.decode(base64UrlDecode(protectedSegment)),
        );

        if (header?.alg !== "dir" || header?.enc !== "A256GCM") {
            throw new Error(
                `The update on "${name}" uses an unsupported JWE algorithm.`,
            );
        }

        const ciphertext = base64UrlDecode(ciphertextSegment);
        const tag = base64UrlDecode(tagSegment);
        const sealed = new Uint8Array(ciphertext.length + tag.length);
        sealed.set(ciphertext);
        sealed.set(tag, ciphertext.length);

        const plaintext = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: base64UrlDecode(ivSegment),
                additionalData: textEncoder.encode(protectedSegment),
                tagLength: 128,
            },
            await this.channelKey(name),
            sealed,
        );

        return textDecoder.decode(plaintext);
    }

    /** Encrypt a whisper as a compact direct-encryption A256GCM JWE. */
    private async encrypt(name: string, plaintext: string): Promise<string> {
        const protectedSegment = ENCRYPTED_PROTECTED_HEADER;
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const sealed = new Uint8Array(
            await crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv,
                    additionalData: textEncoder.encode(protectedSegment),
                    tagLength: 128,
                },
                await this.channelKey(name),
                textEncoder.encode(plaintext),
            ),
        );

        // Compact JWE stores WebCrypto's appended GCM tag separately.
        const ciphertext = sealed.slice(0, -16);
        const tag = sealed.slice(-16);

        return [
            protectedSegment,
            "",
            base64UrlEncode(iv),
            base64UrlEncode(ciphertext),
            base64UrlEncode(tag),
        ].join(".");
    }

    /** Import and cache a channel's WebCrypto key. */
    private channelKey(name: string): Promise<CryptoKey> {
        const jwk = this.channelJwks.get(name);

        if (!jwk || typeof jwk.k !== "string") {
            return Promise.reject(
                new Error(
                    `No decryption key is known for "${name}": the auth endpoint returned none. Is "encryption_key" configured server-side?`,
                ),
            );
        }

        const cached = this.importedKeys.get(name);

        if (cached && cached.k === jwk.k) {
            return cached.key;
        }

        const key = crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"],
        );

        this.importedKeys.set(name, { k: jwk.k, key });

        return key;
    }

    /** Route exact subscription events with authorized member payloads. */
    private handleSubscriptionEvent(event: MessageEvent): void {
        this.lastEventId = event.lastEventId;

        const subscription = parseJson<{
            match?: unknown;
            match_type?: unknown;
            subscriber?: unknown;
            active?: unknown;
            payload?: unknown;
        }>(event.data as string);

        if (
            !subscription ||
            typeof subscription.match !== "string" ||
            typeof subscription.subscriber !== "string" ||
            typeof subscription.active !== "boolean" ||
            subscription.match_type !== "exact"
        ) {
            return;
        }

        if (subscription.active && subscription.payload == null) {
            return; // an unauthorized (phantom) subscription: not a member...
        }

        const name = this.channelNameFromTopic(subscription.match);

        if (name === null) {
            return;
        }

        const buffer = this.pendingSubscriptionEvents.get(name);

        if (buffer) {
            buffer.push([
                subscription.subscriber,
                subscription.active,
                subscription.payload,
            ]);

            return;
        }

        if (!hasOwn(this.channels, name)) {
            return;
        }

        const channel = this.channels[name];

        if (channel instanceof MercurePresenceChannel) {
            channel.applySubscriptionEvent(
                subscription.subscriber,
                subscription.active,
                subscription.payload,
            );
        }
    }

    /** Fetch a presence snapshot after opening while live events are buffered. */
    private async fetchPresenceSnapshot(
        name: string,
    ): Promise<Array<[string, unknown]>> {
        const response = await fetch(
            `${this.url.origin}${this.subscriptionsPath()}/exact/${encodeChannelName(this.channelTopic(name))}`,
            { credentials: "include" },
        );

        if (!response.ok) {
            throw new Error(
                `The subscription snapshot request failed with HTTP ${response.status}.`,
            );
        }

        const snapshot = (await response.json()) as {
            subscriptions?: Array<{
                subscriber: string;
                active: boolean;
                payload?: unknown;
            }>;
        };

        return (snapshot.subscriptions ?? [])
            .filter(
                // Only authorized subscribers receive a member payload...
                (subscription) =>
                    subscription.active && subscription.payload != null,
            )
            .map((subscription) => [
                subscription.subscriber,
                subscription.payload,
            ]);
    }

    /** Authenticate all joined channels in one request. */
    private async authenticate(channelNames: string[]): Promise<{
        ok: boolean;
        rejected: boolean;
        status: number | null;
        denied: string[];
        error?: Error;
    }> {
        let error: Error;
        let status: number | null = null;

        try {
            const response = await fetch(this.options.authEndpoint, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...this.options.auth.headers,
                },
                body: JSON.stringify({ channel_names: channelNames }),
            });

            if (response.ok) {
                this.lastAuthAt = Date.now();

                return {
                    ok: true,
                    rejected: false,
                    status: response.status,
                    denied: this.readAuthResponse(await parseBody(response)),
                };
            }

            status = response.status;
            error = new Error(
                `The broadcasting auth request to "${this.options.authEndpoint}" failed with HTTP ${response.status}.`,
            );
        } catch (cause) {
            error = new Error(
                `The broadcasting auth request to "${this.options.authEndpoint}" failed: ${cause instanceof Error ? cause.message : String(cause)}.`,
            );
        }

        // Treat 4xx responses as rejected batches and retry other failures...
        return {
            ok: false,
            rejected: status !== null && status < 500,
            status,
            denied: [],
            error,
        };
    }

    /** Record auth metadata and return individually denied channels. */
    private readAuthResponse(body: unknown): string[] {
        const response = (body ?? {}) as {
            expires_in?: unknown;
            channel_names?: unknown;
            topic_prefix?: unknown;
            client_events?: unknown;
        };

        const ttl = Number(response.expires_in);
        this.tokenTtl = Number.isFinite(ttl) && ttl > 0 ? ttl : null;

        this.topicPrefix =
            typeof response.topic_prefix === "string"
                ? response.topic_prefix
                : "";
        this.clientEventsEnabled = response.client_events === true;

        this.channelJwks.clear();

        const denied: string[] = [];

        if (Array.isArray(response.channel_names)) {
            response.channel_names.forEach((entry: unknown) => {
                const channel = (entry ?? {}) as {
                    name?: unknown;
                    jwk?: unknown;
                    denied?: unknown;
                };

                if (typeof channel.name !== "string") {
                    return;
                }

                if (channel.denied === true) {
                    denied.push(channel.name);

                    return;
                }

                if (channel.jwk !== null && typeof channel.jwk === "object") {
                    this.channelJwks.set(channel.name, channel.jwk);
                }
            });
        }

        return denied;
    }

    /** Build a presence channel's subscription-event matcher. */
    private subscriptionEventsPattern(channelName: string): string {
        return `${this.subscriptionsPath()}/:match_type/${encodeChannelName(this.channelTopic(channelName))}/:subscriber`;
    }
}

/** Check own properties so names such as "__proto__" cannot traverse prototypes. */
function hasOwn(object: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(object, key);
}

/** Parse JSON without throwing. */
function parseJson<T>(text: string): T | null {
    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
}

/** Read a response body as JSON when possible. */
async function parseBody(response: Response): Promise<unknown> {
    try {
        return (await response.json()) as unknown;
    } catch {
        return null;
    }
}

/** Shared codecs for WebCrypto operations. */
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** The shared compact-JWE protected header and AAD. */
const ENCRYPTED_PROTECTED_HEADER = base64UrlEncode(
    textEncoder.encode(JSON.stringify({ alg: "dir", enc: "A256GCM" })),
);

/** Decode unpadded URL-safe base64. */
function base64UrlDecode(segment: string): Uint8Array<ArrayBuffer> {
    const padded =
        segment.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - (segment.length % 4)) % 4);

    return Uint8Array.from(atob(padded), (character) =>
        character.charCodeAt(0),
    );
}

/** Encode unpadded URL-safe base64. */
function base64UrlEncode(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/** Encode channel names byte-identically to the server's rawurlencode(). */
function encodeChannelName(name: string): string {
    return encodeURIComponent(name).replace(
        /[!'()*]/g,
        (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
    );
}

/** Generate an id for toOthers() self-exclusion. */
function randomId(): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
