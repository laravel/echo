import { EventFormatter } from './../util';
import { Channel } from './channel';

/**
 * This class represents a Pusher channel.
 */
export class PusherChannel extends Channel {
    /**
     * The name of the channel.
     *
     * @type {object}
     */
    name: any;

    /**
     * The pusher client instance.
     *
     * @type {any}
     */
    pusher: any;

    /**
     * Channel options.
     *
     * @type {any}
     */
    options: any;

    /**
     * The event formatter.
     *
     * @type {EventFormatter}
     */
    eventFormatter: EventFormatter;

    /**
     * The subsciption of the channel.
     *
     * @type {any}
     */
    subscription: any;

    /**
     * Create a new class instance.
     *
     * @param  {object} name
     * @param  {any} pusher
     * @param  {any}  options
     */
    constructor(name: any, pusher: any, options: any) {
        super();

        this.name = name;
        this.pusher = pusher;
        this.options = options;

        this.eventFormatter = new EventFormatter;

        if (this.options.namespace) {
            this.eventFormatter.namespace(this.options.namespace);
        }

        this.subscribe();
    }

    /**
     * Subscribe to a Pusher channel.
     *
     * @param  {string} channel
     * @return {object}
     */
    subscribe(): any {
        this.subscription = this.pusher.subscribe(this.name);
    }

    /**
     * Unsubscribe from a Pusher channel.
     *
     * @return {void}
     */
    unsubscribe(): void {
        this.pusher.unsubscribe(this.name);
    }

    /**
     * Listen for an event on the channel instance.
     *
     * @param  {string} event
     * @param  {Function}   callback
     * @return {PusherChannel}
     */
    listen(event: string, callback: Function): PusherChannel {
        this.on(this.eventFormatter.format(event), callback);

        return this;
    }

    /**
     * Bind a channel to an event.
     *
     * @param  {string}   event
     * @param  {Function} callback
     * @return {void}
     */
    on(event: string, callback: Function): void {
        this.subscription.bind(event, callback);
    }
}
