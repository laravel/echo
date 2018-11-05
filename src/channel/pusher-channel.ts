import { EventFormatter } from './../util';
import { Channel } from './channel';
import EchoOptions from '../echoOptions';

/**
 * This class represents a Pusher channel.
 */
export class PusherChannel extends Channel {
    /**
     * The Pusher client instance.
     *
     * @type {Pusher.Pusher}
     */
    pusher: Pusher.Pusher;

    /**
     * The name of the channel.
     *
     * @type {string}
     */
    name: string;

    /**
     * Channel options.
     *
     * @type {EchoOptions}
     */
    options: EchoOptions;

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
    subscription!: Pusher.Channel;

    /**
     * Create a new class instance.
     *
     * @param  {Pusher.Pusher} pusher
     * @param  {string} name
     * @param  {EchoOptions}  options
     */
    constructor(pusher: Pusher.Pusher, name: string, options: EchoOptions) {
        super();

        this.name = name;
        this.pusher = pusher;
        this.options = options;

        this.eventFormatter = new EventFormatter(<string | boolean>this.options.namespace);

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
    listen(event: string, callback: Pusher.EventCallback): PusherChannel {
        this.on(this.eventFormatter.format(event), callback);

        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     *
     * @param  {string} event
     * @return {PusherChannel}
     */
    stopListening(event: string): PusherChannel {
        this.subscription.unbind(this.eventFormatter.format(event));

        return this;
    }

    /**
     * Bind a channel to an event.
     *
     * @param  {string}   event
     * @param  {Function} callback
     * @return {void}
     */
    on(event: string, callback: Pusher.EventCallback): PusherChannel {
        this.subscription.bind(event, callback);

        return this;
    }
}
