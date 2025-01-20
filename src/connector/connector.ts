import { Channel, PresenceChannel } from '../channel';
import { resolveCsrf } from '../util/csrf'

export abstract class Connector<TPublic extends Channel, TPrivate extends Channel, TPresence extends PresenceChannel> {
    /**
     * Default connector options.
     */
    private _defaultOptions: any = {
        channelAuthorization: {
            endpoint: '/broadcasting/auth',
            headers: {},
        },
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
    constructor(options: any) {
        this.setOptions(options);
        this.connect();
    }

    /**
     * Merge the custom options with the defaults.
     */
    protected setOptions(options: any): any {
        return Object.assign(this._defaultOptions, options);
    }

    /**
     * Extract the CSRF token from the page.
     */
    protected csrfToken(): null | string {
        return resolveCsrf(this.options.csrfToken);
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
    abstract socketId(): string;

    /**
     * Disconnect from the Echo server.
     */
    abstract disconnect(): void;
}
