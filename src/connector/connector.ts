import type { Channel, PresenceChannel } from '../channel';
import type { BroadcastDriver, EchoOptions } from '../echo';

export type EchoOptionsWithDefaults<TBroadcaster extends BroadcastDriver> = {
    broadcaster: TBroadcaster;
    auth: {
        headers: Record<string, string>;
    };
    authEndpoint: string;
    userAuthentication: {
        endpoint: string;
        headers: Record<string, string>;
    };
    csrfToken: string | null;
    bearerToken: string | null;
    host: string | null;
    key: string | null;
    namespace: string | false;

    [key: string]: any;
};

export abstract class Connector<
    TBroadcastDriver extends BroadcastDriver,
    TPublic extends Channel,
    TPrivate extends Channel,
    TPresence extends PresenceChannel
> {
    /**
     * Default connector options.
     */
    public static readonly _defaultOptions = {
        auth: {
            headers: {},
        },
        authEndpoint: '/broadcasting/auth',
        userAuthentication: {
            endpoint: '/broadcasting/user-auth',
            headers: {},
        },
        csrfToken: null,
        bearerToken: null,
        host: null,
        key: null,
        namespace: 'App.Events',
    } as const;

    /**
     * Connector options.
     */
    options: EchoOptionsWithDefaults<TBroadcastDriver>;

    /**
     * Create a new class instance.
     */
    constructor(options: EchoOptions<TBroadcastDriver>) {
        this.setOptions(options);
        this.connect();
    }

    /**
     * Merge the custom options with the defaults.
     */
    protected setOptions(options: EchoOptions<TBroadcastDriver>): void {
        this.options = {
            ...Connector._defaultOptions,
            ...options,
            broadcaster: options.broadcaster as TBroadcastDriver,
        };

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
    }

    /**
     * Extract the CSRF token from the page.
     */
    protected csrfToken(): null | string {
        let selector;

        if (typeof window !== 'undefined' && typeof window.Laravel !== 'undefined' && window.Laravel.csrfToken) {
            return window.Laravel.csrfToken;
        }

        if (this.options.csrfToken) {
            return this.options.csrfToken;
        }

        if (
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
     * Get a channel instance by name.
     */
    abstract channel(channel: string): TPublic;

    /**
     * Get a private channel instance by name.
     */
    abstract privateChannel(channel: string): TPrivate;

    /**
     * Get a presence channel instance by name.
     */
    abstract presenceChannel(channel: string): TPresence;

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
    abstract socketId(): string | undefined;

    /**
     * Disconnect from the Echo server.
     */
    abstract disconnect(): void;
}
