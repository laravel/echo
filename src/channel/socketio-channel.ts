import { EventFormatter } from './../util';
import { Channel } from './channel';

/**
 * This class represents a Socket.io channel.
 */
export class SocketIoChannel extends Channel {
    /**
     * The Socket.io client instance.
     *
     * @type {any}
     */
    socket: any;

    /**
     * The name of the channel.
     *
     * @type {object}
     */
    name: any;

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
     * The event callbacks applied to the channel.
     *
     * @type {any}
     */
    events: any = {};

    /**
     * Create a new class instance.
     *
     * @param  {any} socket
     * @param  {string} name
     * @param  {any} options
     */
    constructor(socket: any, name: string, options: any, settings: any) {
        super();

        this.name = name;
        this.socket = socket;
        this.options = options;

        this.eventFormatter = new EventFormatter(settings);

        if (this.options.namespace) {
            this.eventFormatter.namespace(this.options.namespace);
        }

        this.subscribe();
    }

    /**
     * Subscribe to a Socket.io channel.
     *
     * @return {object}
     */
    subscribe(): any {
        this.subscription = this.socket.emit('subscribe', {
            channel: this.name,
            auth: this.options.auth || {}
        });
    }

    /**
     * Unsubscribe from channel and ubind event callbacks.
     *
     * @return {void}
     */
    unsubscribe(): void {
        this.unbind();

        this.socket.emit('unsubscribe', {
            channel: this.name,
            auth: this.options.auth || {}
        });
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
     * Bind the channel's socket to an event and store the callback.
     *
     * @param  {string} event
     * @param  {Function} callback
     */
    on(event: string, callback: Function): void {
        let listener = (channel, data) => {
            if (this.name == channel) {
                callback(data);
            }
        };

        this.socket.on(event, listener);
        this.bind(event, listener);
    }

    /**
     * Bind the channel's socket to an event and store the callback.
     *
     * @param  {string}   event
     * @param  {Function} callback
     * @return {void}
     */
    bind(event: string, callback: Function): void {
        this.events[event] = this.events[event] || [];
        this.events[event].push(callback);
    }

    /**
     * Unbind the channel's socket from all stored event callbacks.
     *
     * @return {void}
     */
    unbind(): void {
        Object.keys(this.events).forEach(event => {
            this.events[event].forEach(callback => {
                this.subscription.removeListener(event, callback);
            });

            delete this.events[event];
        });
    }
}
