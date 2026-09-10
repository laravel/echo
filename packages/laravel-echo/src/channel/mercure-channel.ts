import { EventFormatter } from "../util";
import { Channel } from "./channel";
import type { EchoOptionsWithDefaults } from "../connector";
import type { BroadcastDriver } from "../echo";

/** Structural interface that avoids a runtime channel/connector import cycle. */
export interface MercureWhisperPublisher {
    whisper(channel: string, event: string, data: unknown): void;

    listenForWhispers(channel: string): void;
}

/** A Mercure channel. */
export class MercureChannel extends Channel {
    /** The channel name. */
    name: string;

    /** The event formatter. */
    eventFormatter: EventFormatter;

    /** Event callbacks keyed by wire event name. */
    private listeners: Map<string, CallableFunction[]> = new Map();

    /** Subscription callbacks. */
    private subscribedCallbacks: CallableFunction[] = [];

    /** Error callbacks. */
    private errorCallbacks: CallableFunction[] = [];

    /** The connector used to publish whispers. */
    protected whisperer?: MercureWhisperPublisher;

    /** Create a channel. */
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

    /** Listen for an event. */
    listen(event: string, callback: CallableFunction): this {
        const formatted = this.eventFormatter.format(event);

        this.listeners.set(formatted, [
            ...(this.listeners.get(formatted) ?? []),
            callback,
        ]);

        return this;
    }

    /** Stop listening for an event. */
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

    /** Register a subscription callback. */
    subscribed(callback: CallableFunction): this {
        this.subscribedCallbacks.push(callback);

        return this;
    }

    /** Register an error callback. */
    error(callback: CallableFunction): this {
        this.errorCallbacks.push(callback);

        return this;
    }

    /** Public channels cannot scope whisper grants to authorized members. */
    whisper(_eventName: string, _data: Record<any, any>): this {
        throw new Error(
            "Public Mercure channels do not support whisper(): use a private or presence channel, whose members are granted a whisper topic.",
        );
    }

    /** Warn when registering a whisper listener that cannot receive events. */
    listenForWhisper(event: string, callback: CallableFunction): this {
        // eslint-disable-next-line no-console
        console.warn(
            `listenForWhisper("${event}"): public Mercure channels cannot receive whispers, so this listener will never fire.`,
        );

        return super.listenForWhisper(event, callback);
    }

    /** Dispatch an incoming event. */
    dispatch(event: string, payload: unknown): void {
        (this.listeners.get(event) ?? []).forEach((callback) =>
            callback(payload),
        );
    }

    /** Notify subscription callbacks. */
    notifySubscribed(): void {
        this.subscribedCallbacks.forEach((callback) => callback());
    }

    /** Notify error callbacks. */
    notifyError(error: unknown): void {
        this.errorCallbacks.forEach((callback) => callback(error));
    }
}
