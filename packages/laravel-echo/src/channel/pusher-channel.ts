import { EventFormatter } from "../util";
import { Channel } from "./channel";
import type Pusher from "pusher-js";
import type { Channel as BasePusherChannel } from "pusher-js";
import type { EchoOptionsWithDefaults } from "../connector";
import type { BroadcastDriver } from "../echo";

/**
 * This class represents a Pusher channel.
 */
export class PusherChannel<
    TBroadcastDriver extends BroadcastDriver,
> extends Channel {
    /**
     * The Pusher client instance.
     */
    pusher: Pusher;

    /**
     * The name of the channel.
     */
    name: string;

    /**
     * The event formatter.
     */
    eventFormatter: EventFormatter;

    /**
     * The subscription of the channel.
     */
    subscription: BasePusherChannel;

    /**
     * Create a new class instance.
     */
    constructor(
        pusher: Pusher,
        name: string,
        options: EchoOptionsWithDefaults<TBroadcastDriver>,
    ) {
        super();

        this.name = name;
        this.pusher = pusher;
        this.options = options;
        this.eventFormatter = new EventFormatter(this.options.namespace);

        this.subscribe();
    }

    /**
     * Subscribe to a Pusher channel.
     */
    subscribe(): void {
        this.subscription = this.pusher.subscribe(this.name);
    }

    /**
     * Unsubscribe from a Pusher channel.
     */
    unsubscribe(): void {
        this.pusher.unsubscribe(this.name);
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
        this.subscription.bind_global((event: string, data: unknown) => {
            if (event.startsWith("pusher:")) {
                return;
            }

            let namespace = String(this.options.namespace ?? "").replace(
                /\./g,
                "\\",
            );

            let formattedEvent = event.startsWith(namespace)
                ? event.substring(namespace.length + 1)
                : "." + event;

            callback(formattedEvent, data);
        });

        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: CallableFunction): this {
        if (callback) {
            this.subscription.unbind(
                this.eventFormatter.format(event),
                callback,
            );
        } else {
            this.subscription.unbind(this.eventFormatter.format(event));
        }

        return this;
    }

    /**
     * Stop listening for all events on the channel instance.
     */
    stopListeningToAll(callback?: CallableFunction): this {
        if (callback) {
            this.subscription.unbind_global(callback);
        } else {
            this.subscription.unbind_global();
        }

        return this;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: CallableFunction): this {
        this.on("pusher:subscription_succeeded", () => {
            callback();
        });

        return this;
    }

    /**
     * Register a callback to be called anytime a subscription error occurs.
     */
    error(callback: CallableFunction): this {
        this.on("pusher:subscription_error", (status: Record<string, any>) => {
            callback(status);
        });

        return this;
    }

    /**
     * Bind a channel to an event.
     */
    on(event: string, callback: CallableFunction): this {
        this.subscription.bind(event, callback);

        return this;
    }
}
