import { EventFormatter } from './../util';
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
        this.subscription.on(event, (channel, data) => {
            if (this.name == this.subscription.name) {
                callback(data);
            }
        });
    }

    /**
     * Send request message to the server.
     *
     * @param  {string}   request
     * @param  {Object}   data
     */
    request(request: string, data: Object) {
        if (!this.isPrivate())
            return false;

        return this.subscription.emit('request', {
            channel: this.name,
            request: request,
            data:    data,
            auth:    this.options.auth || {}
        });
    }

    /**
     * Check if channel is private
     */
    isPrivate() {
        var _privateChannels = ['private-*', 'presence-*'];
        var isPrivateChannel = false;
        var channel = this.name;
        _privateChannels.forEach(function (privateChannel) {
            var regex = new RegExp(privateChannel.replace('\*', '.*'));
            if (regex.test(channel))
                isPrivateChannel = true;
        });
        return isPrivateChannel;
    }
}
