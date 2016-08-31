import { EventFormatter, ArrayHelper } from './../util';
import { Channel } from './channel';

/**
 * This class represents a Socket.io channel.
 */
export class SocketIoChannel extends Channel {
    /**
     * The event formatter.
     *
     * @type {EventFormatter}
     */
    eventFormatter: EventFormatter;

    /**
     * Create a new class instance.
     *
     * @param  {string} name
     * @param  {object} subscription
     * @param  {any} options
     */
    constructor(
        public name: string,
        public subscription: any,
        public options: any
    ) {
        super();

        this.eventFormatter = new EventFormatter;

        if (this.options.namespace) {
            this.eventFormatter.namespace(this.options.namespace);
        }
    }

    /**
     * Listen for an event on the channel instance.
     *
     * @param  {string} event
     * @param  {Function} callback
     * @return {SocketIoChannel}
     */
    listen(event: string, callback: Function): SocketIoChannel {
        this.on(this.eventFormatter.format(event), callback);

        return this;
    }

    /**
     * Bind a channel to an event.
     *
     * @param  {string}   event
     * @param  {Function} callback
     */
    on(event: string, callback: Function) {
        this.subscription.socket.on(event, (channel, data) => {
            if (this.name == channel) {
                callback(data);
            }
        });

        if(!this.subscription.events) this.subscription.events = {};

        if(!ArrayHelper.has(this.subscription.events, event)) this.subscription.events[event] = [];

        this.subscription.events[event].push(callback);
    }
}
