import { EventFormatter } from "../util";
import { Channel } from "./channel";
import type { EchoOptionsWithDefaults } from "../connector";

/**
 * This class represents a poll channel.
 */
export class PollChannel extends Channel {
    /**
     * The name of the channel.
     */
    name: string;

    /**
     * The event formatter.
     */
    eventFormatter: EventFormatter;

    /**
     * Local event listener registry.
     */
    private listeners: Map<string, Set<CallableFunction>> = new Map();

    /**
     * Subscription success callbacks.
     */
    private subscribedCallbacks: Set<CallableFunction> = new Set();

    /**
     * Error callbacks.
     */
    private errorCallbacks: Set<CallableFunction> = new Set();

    /**
     * Create a new class instance.
     */
    constructor(name: string, options: EchoOptionsWithDefaults<"poll">) {
        super();
        this.name = name;
        this.options = options;
        this.eventFormatter = new EventFormatter(this.options.namespace);
    }

    /**
     * Dispatch an event to local listeners.
     */
    dispatch(event: string, data: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach((cb) => cb(data));
        }
    }

    /**
     * Notify that subscription succeeded.
     */
    notifySubscribed(): void {
        this.subscribedCallbacks.forEach((cb) => cb());
    }

    /**
     * Notify that an error occurred.
     */
    notifyError(error: any): void {
        this.errorCallbacks.forEach((cb) => cb(error));
    }

    /**
     * Subscribe to a channel.
     */
    subscribe(): void {
        //
    }

    /**
     * Unsubscribe from a channel.
     */
    unsubscribe(): void {
        this.listeners.clear();
        this.subscribedCallbacks.clear();
        this.errorCallbacks.clear();
    }

    /**
     * Listen for an event on the channel instance.
     */
    listen(event: string, callback: CallableFunction): this {
        this.on(this.eventFormatter.format(event), callback);
        return this;
    }

    /**
     * Listen for all events on the channel instance.
     */
    listenToAll(callback: CallableFunction): this {
        this.on("*", callback);
        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: CallableFunction): this {
        const formatted = this.eventFormatter.format(event);
        if (callback) {
            this.listeners.get(formatted)?.delete(callback);
        } else {
            this.listeners.delete(formatted);
        }
        return this;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: CallableFunction): this {
        this.subscribedCallbacks.add(callback);
        return this;
    }

    /**
     * Register a callback to be called anytime an error occurs.
     */
    error(callback: CallableFunction): this {
        this.errorCallbacks.add(callback);
        return this;
    }

    /**
     * Bind a channel to an event.
     */
    on(event: string, callback: CallableFunction): this {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
        return this;
    }
}
