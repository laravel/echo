import { EventFormatter } from './../util';
import { Channel } from './channel';

/**
 * This class represents a Pusher channel.
 */
export class PusherChannel extends Channel {
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
     * The subsciption of the channel.
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
    listen(event: string, callback: Function): PusherChannel {
        this.on(this.eventFormatter.format(event), callback);

        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string): PusherChannel {
        this.subscription.unbind(this.eventFormatter.format(event));

        return this;
    }

    /**
     * Bind a channel to an event.
     */
    on(event: string, callback: Function): PusherChannel {
        this.subscription.bind(event, callback);

        return this;
    }
}
