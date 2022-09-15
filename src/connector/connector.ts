import { Channel, PresenceChannel } from './../channel';

type CustomConnector = new (options: Options) => Connector;

type Broadcaster = 'socket.io' | 'pusher' | 'null' | CustomConnector

export interface Options {
    auth?: {
        headers: Record<string, string>
    },
    userAuthentication?: {
        endpoint?: string,
        headers?: Record<string, string>,
    },
    broadcaster?: Broadcaster,
    csrfToken?: string | null,
    bearerToken?: string | null,
    [K: string]: unknown
}

export abstract class Connector {
    /**
     * Default connector options.
     */
    private _defaultOptions: Options = {
        auth: {
            headers: {},
        },
        authEndpoint: '/broadcasting/auth',
        userAuthentication: {
            endpoint: '/broadcasting/user-auth',
            headers: {},
        },
        broadcaster: 'pusher',
        csrfToken: null,
        bearerToken: null,
        host: null,
        key: null,
        namespace: 'App.Events',
    };

    /**
     * Connector options.
     */
    options: any;

    /**
     * Create a new class instance.
     */
    constructor(options: Options) {
        this.setOptions(options);
        this.connect();
    }

    /**
     * Merge the custom options with the defaults.
     */
    protected setOptions(options: Options): any {
        this.options = Object.assign(this._defaultOptions, options);

        let token = this.csrfToken();

        if (token) {
            this.options.auth.headers['X-CSRF-TOKEN'] = token;
            this.options.userAuthentication.headers['X-CSRF-TOKEN'] = token;
        }

        token = this.options.bearerToken;

        if (token) {
            this.options.auth.headers['Authorization'] = 'Bearer ' + token;
            this.options.userAuthentication.headers['Authorization'] = 'Bearer ' + token;
        }

        return options;
    }

    /**
     * Extract the CSRF token from the page.
     */
    protected csrfToken(): null | string {
        let selector;

        if (typeof window !== 'undefined' && window['Laravel'] && window['Laravel'].csrfToken) {
            return window['Laravel'].csrfToken;
        } else if (this.options.csrfToken) {
            return this.options.csrfToken;
        } else if (
            typeof document !== 'undefined' &&
            typeof document.querySelector === 'function' &&
            (selector = document.querySelector('meta[name="csrf-token"]'))
        ) {
            return selector.getAttribute('content');
        }

        return null;
    }

    /**
     * Create a fresh connection.
     */
    abstract connect(): void;

    /**
     * Listen for an event on a channel instance.
     */
    abstract listen(name: string, event: string, callback: CallableFunction): Channel;

    /**
     * Get a channel instance by name.
     */
    abstract channel(channel: string): Channel;

    /**
     * Get a private channel instance by name.
     */
    abstract privateChannel(channel: string): Channel;

    /**
     * Get a presence channel instance by name.
     */
    abstract presenceChannel(channel: string): PresenceChannel;

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    abstract leave(channel: string): void;

    /**
     * Leave the given channel.
     */
    abstract leaveChannel(channel: string): void;

    /**
     * Get the socket_id of the connection.
     */
    abstract socketId(): string;

    /**
     * Disconnect from the Echo server.
     */
    abstract disconnect(): void;
}
