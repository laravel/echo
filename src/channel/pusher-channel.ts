import { EventFormatter } from '../util';
import { Channel } from './channel';

/**
 * This class represents a Pusher channel.
 */
export abstract class PusherChannel<T> extends Channel<T> {
    /**
     * The Pusher client instance.
     */
    pusher: any;

    /**
     * The name of the channel.
     */
    name: any;

    /**
     * Channel options.
     */
    options: any;

    /**
     * The event formatter.
     */
    eventFormatter: EventFormatter;

    /**
     * The subscription of the channel.
     */
    subscription: any;

    /**
     * Create a new class instance.
     */
    constructor(pusher: any, name: any, options: any) {
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
    subscribe(): any {
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
    listen(event: string, callback: Function): T {
        this.on(this.eventFormatter.format(event), callback);

        return this as unknown as T;
    }

    /**
     * Listen for all events on the channel instance.
     */
    listenToAll(callback: Function): T {
        this.subscription.bind_global((event, data) => {
            if (event.startsWith('pusher:')) {
                return;
            }

            let namespace = this.options.namespace.replace(/\./g, '\\');

            let formattedEvent = event.startsWith(namespace) ? event.substring(namespace.length + 1) : '.' + event;

            callback(formattedEvent, data);
        });

        return this as unknown as T;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: Function): T {
        if (callback) {
            this.subscription.unbind(this.eventFormatter.format(event), callback);
        } else {
            this.subscription.unbind(this.eventFormatter.format(event));
        }

        return this as unknown as T;
    }

    /**
     * Stop listening for all events on the channel instance.
     */
    stopListeningToAll(callback?: Function): T {
        if (callback) {
            this.subscription.unbind_global(callback);
        } else {
            this.subscription.unbind_global();
        }

        return this as unknown as T;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: Function): T {
        this.on('pusher:subscription_succeeded', () => {
            callback();
        });

        return this as unknown as T;
    }

    /**
     * Register a callback to be called anytime a subscription error occurs.
     */
    error(callback: Function): T {
        this.on('pusher:subscription_error', (status) => {
            callback(status);
        });

        return this as unknown as T;
    }

    /**
     * Bind a channel to an event.
     */
    on(event: string, callback: Function): T {
        this.subscription.bind(event, callback);

        return this as unknown as T;
    }
}
