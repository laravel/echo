import { EventFormatter } from './util';
import { Channel, PresenceChannel } from './channel'
import { PusherConnector, SocketIoConnector } from './connector';

/**
 * This class is the primary API for interacting with broadcasting.
 */
class Echo {

    /**
     * The broadcasting connector.
     *
     * @type {object}
     */
    connector: any;

    /**
     * The Echo options.
     *
     * @type {array}
     */
    options: any;

    /**
     * Create a new class instance.
     *
     * @param  {object} options
     */
    constructor(options: any) {
        this.options = options;

        if (typeof Vue === 'function' && Vue.http) {
            this.registerVueRequestInterceptor();
        }

        if (this.options.broadcaster == 'pusher') {
            if (!window['Pusher']) {
                window['Pusher'] = require('pusher-js');
            }

            this.connector = new PusherConnector(this.options);
        } else if (this.options.broadcaster == 'socket.io') {
            this.connector = new SocketIoConnector(this.options);
        }
    }

    /**
     * Register a Vue HTTP interceptor to add the X-Socket-ID header.
     */
    registerVueRequestInterceptor() {
        Vue.http.interceptors.push((request, next) => {
            if (this.socketId()) {
                request.headers['X-Socket-ID'] = this.socketId();
            }

            next();
        });
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(channel: string, event: string, callback: Function) {
        return this.connector.listen(channel, event, callback);
    }

    /**
     * Get a channel instance by name.
     *
     * @param  {string}  channel
     * @return {object}
     */
    channel(channel: string): Channel {
        return this.connector.channel(channel);
    }

    /**
     * Get a private channel instance by name.
     *
     * @param  {string} channel
     * @return {object}
     */
    private(channel: string): Channel {
        return this.connector.privateChannel(channel);
    }

    /**
     * Get a presence channel instance by name.
     *
     * @param  {string} channel
     * @return {object}
     */
    join(channel: string): PresenceChannel {
        return this.connector.presenceChannel(channel);
    }

    /**
     * Leave the given channel.
     *
     * @param  {string} channel
     */
    leave(channel: string) {
        this.connector.leave(channel);
    }

    /**
     * Get the Socket ID for the connection.
     *
     * @return {string}
     */
    socketId(): string {
        return this.connector.socketId();
    }
}

module.exports = Echo;
