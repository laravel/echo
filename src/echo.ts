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

        if (typeof axios === 'function') {
            this.registerAxiosRequestInterceptor();
        }

        if (typeof jQuery === 'function') {
            this.registerjQueryAjaxSetup();
        }

        if (this.options.broadcaster == 'pusher') {
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
                request.headers.set('X-Socket-ID', this.socketId());
            }

            next();
        });
    }

    /**
     * Register an Axios HTTP interceptor to add the X-Socket-ID header.
     */
    registerAxiosRequestInterceptor() {
        axios.interceptors.request.use((config) => {
            if (this.socketId()) {
                config.headers['X-Socket-Id'] = this.socketId();
            }

            return config;
        });
    }

    /**
     * Register jQuery AjaxSetup to add the X-Socket-ID header.
     */
    registerjQueryAjaxSetup() {
        if (typeof jQuery.ajax != 'undefined') {
            jQuery.ajaxSetup({
                beforeSend: (xhr) => {
                    if (this.socketId()) {
                        xhr.setRequestHeader('X-Socket-Id', this.socketId());
                    }
                }
            });
        }
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

    /**
     * Disconnect from the Echo server.
     *
     * @return void
     */
    disconnect(): void {
        this.connector.disconnect();
    }
}

module.exports = Echo;
