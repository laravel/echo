import { Connector } from './connector';
import { EventFormatter } from './util';
import { Channel, PresenceChannel } from './channel'
import EchoOptions from './echoOptions'
import { PusherConnector, SocketIoConnector, NullConnector } from './connector';

/**
 * This class is the primary API for interacting with broadcasting.
 */
export default class Echo {

    /**
     * The broadcasting connector.
     *
     * @type {object}
     */
    connector!: Connector;

    /**
     * The Echo options.
     *
     * @type {array}
     */
    options: EchoOptions;

    /**
     * Create a new class instance.
     *
     * @param  {object} options
     */
    constructor(options: EchoOptions) {
        this.options = options;

        if (typeof (<any>window).Vue === 'function' && (<any>window).Vue.http) {
            this.registerVueRequestInterceptor();
        }

        if (typeof (<any>window).axios === 'function') {
            this.registerAxiosRequestInterceptor();
        }

        if (typeof (<any>window).jQuery === 'function') {
            this.registerjQueryAjaxSetup();
        }

        if (this.options.broadcaster == 'pusher') {
            this.connector = new PusherConnector(this.options);
        } else if (this.options.broadcaster == 'socket.io') {
            this.connector = new SocketIoConnector(this.options);
        } else if (this.options.broadcaster == 'null') {
            this.connector = new NullConnector(this.options);
        }
    }

    /**
     * Register a Vue HTTP interceptor to add the X-Socket-ID header.
     */
    registerVueRequestInterceptor() {
        (<any>window).Vue.http.interceptors.push((request: any, next: any) => {
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
        (<any>window).axios.interceptors.request.use((config: any) => {
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
        if (typeof (<any>window).jQuery.ajax != 'undefined') {
            (<any>window).jQuery.ajaxSetup({
                beforeSend: (xhr: any) => {
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
