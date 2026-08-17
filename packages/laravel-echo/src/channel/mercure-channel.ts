import { EventFormatter } from "../util";
import { Channel } from "./channel";
import type { EchoOptionsWithDefaults } from "../connector";
import type { BroadcastDriver } from "../echo";

/**
 * The connector-side whisper publisher a channel delegates whisper() to.
 * A structural interface rather than the MercureConnector class itself,
 * to avoid a runtime import cycle between the channel and the connector.
 */
export interface MercureWhisperPublisher {
    whisper(channel: string, event: string, data: unknown): void;
}

/**
 * This class represents a Mercure channel.
 */
export class MercureChannel extends Channel {
    /**
     * The name of the channel.
     */
    name: string;

    /**
     * The event formatter.
     */
    eventFormatter: EventFormatter;

    /**
     * User supplied callbacks for events on this channel, keyed by their
     * formatted (wire) event name.
     */
    private listeners: Map<string, CallableFunction[]> = new Map();

    /**
     * Callbacks to run once the shared connection (re)subscribes.
     */
    private subscribedCallbacks: CallableFunction[] = [];

    /**
     * Callbacks to run whenever the shared connection errors.
     */
    private errorCallbacks: CallableFunction[] = [];

    /**
     * The connector to publish whispers through, when constructed by one.
     */
    protected whisperer?: MercureWhisperPublisher;

    /**
     * Create a new class instance.
     */
    constructor(
        name: string,
        options: EchoOptionsWithDefaults<BroadcastDriver>,
        whisperer?: MercureWhisperPublisher,
    ) {
        super();

        this.name = name;
        this.options = options;
        this.whisperer = whisperer;
        this.eventFormatter = new EventFormatter(this.options.namespace);
    }

    /**
     * Listen for an event on the channel instance.
     */
    listen(event: string, callback: CallableFunction): this {
        const formatted = this.eventFormatter.format(event);

        this.listeners.set(formatted, [
            ...(this.listeners.get(formatted) ?? []),
            callback,
        ]);

        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: CallableFunction): this {
        const formatted = this.eventFormatter.format(event);

        if (!callback) {
            this.listeners.delete(formatted);
        } else {
            const remaining = (this.listeners.get(formatted) ?? []).filter(
                (registered) => registered !== callback,
            );

            if (remaining.length === 0) {
                this.listeners.delete(formatted);
            } else {
                this.listeners.set(formatted, remaining);
            }
        }

        return this;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: CallableFunction): this {
        this.subscribedCallbacks.push(callback);

        return this;
    }

    /**
     * Register a callback to be called anytime an error occurs.
     */
    error(callback: CallableFunction): this {
        this.errorCallbacks.push(callback);

        return this;
    }

    /**
     * Send a whisper event to other clients in the channel.
     *
     * Only guarded channels support whispers (see
     * {@see MercurePrivateChannel.whisper}): a public channel has no
     * authorized member set to scope a client publish grant to.
     */
    whisper(_eventName: string, _data: Record<any, any>): this {
        throw new Error(
            "Public Mercure channels do not support whisper(): use a private or presence channel, whose members are granted a whisper topic.",
        );
    }

    /**
     * Listen for a whisper event on the channel instance.
     *
     * No client can whisper on a public Mercure channel (see whisper()),
     * so warn: a listener that never fires is otherwise a silent trap.
     */
    listenForWhisper(event: string, callback: CallableFunction): this {
        // eslint-disable-next-line no-console
        console.warn(
            `listenForWhisper("${event}"): public Mercure channels cannot receive whispers, so this listener will never fire.`,
        );

        return super.listenForWhisper(event, callback);
    }

    /**
     * Dispatch an incoming broadcast payload to every listener registered
     * for the given (already wire-formatted) event name.
     *
     * @internal called by the connector.
     */
    dispatch(event: string, payload: unknown): void {
        (this.listeners.get(event) ?? []).forEach((callback) =>
            callback(payload),
        );
    }

    /**
     * Notify this channel that the shared connection (re)subscribed.
     *
     * @internal called by the connector.
     */
    notifySubscribed(): void {
        this.subscribedCallbacks.forEach((callback) => callback());
    }

    /**
     * Notify this channel that the shared connection errored.
     *
     * @internal called by the connector.
     */
    notifyError(error: unknown): void {
        this.errorCallbacks.forEach((callback) => callback(error));
    }
}
