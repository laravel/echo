import { Channel, PresenceChannel } from './channel';
import { PusherConnector, SocketIoConnector, NullConnector } from './connector';

/**
 * This class is the primary API for interacting with broadcasting.
 */
export default class Echo {
    /**
     * The broadcasting connector.
     */
    connector: any;

    /**
     * The Echo options.
     */
    options: any;

    /**
     * Create a new class instance.
     */
    constructor(options: any) {
        this.options = options;
        this.connect();

        if (!this.options.withoutInterceptors) {
            this.registerInterceptors();
        }
    }

    /**
     * Get a channel instance by name.
     */
    channel(channel: string): Channel {
        return this.connector.channel(channel);
    }

    /**
     * Create a new connection.
     */
    connect(): void {
        if (this.options.broadcaster == 'pusher') {
            this.connector = new PusherConnector(this.options);
        } else if (this.options.broadcaster == 'socket.io') {
            this.connector = new SocketIoConnector(this.options);
        } else if (this.options.broadcaster == 'null') {
            this.connector = new NullConnector(this.options);
        } else if (typeof this.options.broadcaster == 'function') {
            this.connector = new this.options.broadcaster(this.options);
        }
    }

    /**
     * Disconnect from the Echo server.
     */
    disconnect(): void {
        this.connector.disconnect();
    }

    /**
     * Get a presence channel instance by name.
     */
    join(channel: string): PresenceChannel {
        return this.connector.presenceChannel(channel);
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(channel: string): void {
        this.connector.leave(channel);
    }

    /**
     * Leave the given channel.
     */
    leaveChannel(channel: string): void {
        this.connector.leaveChannel(channel);
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(channel: string, event: string, callback: Function): Channel {
        return this.connector.listen(channel, event, callback);
    }

    /**
     * Get a private channel instance by name.
     */
    private(channel: string): Channel {
        return this.connector.privateChannel(channel);
    }

    /**
     * Get a private encrypted channel instance by name.
     */
    encryptedPrivate(channel: string): Channel {
        return this.connector.encryptedPrivateChannel(channel);
    }

    /**
     * Get the Socket ID for the connection.
     */
    socketId(): string {
        return this.connector.socketId();
    }

    /**
     * Register 3rd party request interceptiors. These are used to automatically
     * send a connections socket id to a Laravel app with a X-Socket-Id header.
     */
    registerInterceptors(): void {
        if (typeof Vue === 'function' && Vue.http) {
            this.registerVueRequestInterceptor();
        }

        if (typeof axios === 'function') {
            this.registerAxiosRequestInterceptor();
        }

        if (typeof jQuery === 'function') {
            this.registerjQueryAjaxSetup();
        }

        if (typeof Turbo === 'object') {
            this.registerTurboRequestInterceptor();
        }
    }

    /**
     * Register a Vue HTTP interceptor to add the X-Socket-ID header.
     */
    registerVueRequestInterceptor(): void {
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
    registerAxiosRequestInterceptor(): void {
        axios.interceptors.request.use((config) => {
            if (this.socketId()) {
                config.headers['X-Socket-Id'] = this.socketId();
            }

            return config;
        });
    }

    /**
     * Register jQuery AjaxPrefilter to add the X-Socket-ID header.
     */
    registerjQueryAjaxSetup(): void {
        if (typeof jQuery.ajax != 'undefined') {
            jQuery.ajaxPrefilter((options, originalOptions, xhr) => {
                if (this.socketId()) {
                    xhr.setRequestHeader('X-Socket-Id', this.socketId());
                }
            });
        }
    }

    /**
     * Register the Turbo Request interceptor to add the X-Socket-ID header.
     */
    registerTurboRequestInterceptor(): void {
        document.addEventListener('turbo:before-fetch-request', (event: any) => {
            event.detail.fetchOptions.headers['X-Socket-Id'] = this.socketId();
        });
    }
}

/**
 * Export channel classes for TypeScript.
 */
export { Channel, PresenceChannel };
