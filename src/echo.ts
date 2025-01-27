import {
    Channel,
    NullChannel,
    NullEncryptedPrivateChannel,
    NullPresenceChannel,
    NullPrivateChannel,
    type PresenceChannel,
    PusherChannel,
    PusherEncryptedPrivateChannel,
    PusherPresenceChannel,
    PusherPrivateChannel,
    SocketIoChannel,
    SocketIoPresenceChannel,
    SocketIoPrivateChannel,
} from './channel';
import { Connector, PusherConnector, SocketIoConnector, NullConnector } from './connector';
import { isConstructor } from './util';

/**
 * This class is the primary API for interacting with broadcasting.
 */
export default class Echo<T extends keyof Broadcaster> {
    /**
     * The broadcasting connector.
     */
    connector: Broadcaster[Exclude<T, 'function'>]['connector'];

    /**
     * The Echo options.
     */
    options: EchoOptions<T>;

    /**
     * Create a new class instance.
     */
    constructor(options: EchoOptions<T>) {
        this.options = options;
        this.connect();

        if (!this.options.withoutInterceptors) {
            this.registerInterceptors();
        }
    }

    /**
     * Get a channel instance by name.
     */
    channel(channel: string): Broadcaster[T]['public'] {
        return this.connector.channel(channel);
    }

    /**
     * Create a new connection.
     */
    connect(): void {
        if (this.options.broadcaster === 'reverb') {
            this.connector = new PusherConnector({
                ...this.options,
                cluster: '',
            } as EchoOptions<'reverb'>);
        } else if (this.options.broadcaster === 'pusher') {
            this.connector = new PusherConnector(this.options as EchoOptions<'pusher'>);
        } else if (this.options.broadcaster === 'socket.io') {
            this.connector = new SocketIoConnector(this.options as EchoOptions<'socket.io'>);
        } else if (this.options.broadcaster === 'null') {
            this.connector = new NullConnector(this.options as EchoOptions<'null'>);
        } else if (typeof this.options.broadcaster === 'function' && isConstructor(this.options.broadcaster)) {
            this.connector = new this.options.broadcaster(this.options as EchoOptions<'function'>);
        } else {
            throw new Error(
                `Broadcaster ${typeof this.options.broadcaster} ${String(this.options.broadcaster)} is not supported.`
            );
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
    join(channel: string): Broadcaster[T]['presence'] {
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
     * Leave all channels.
     */
    leaveAllChannels(): void {
        for (const channel in this.connector.channels) {
            this.leaveChannel(channel);
        }
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(channel: string, event: string, callback: CallableFunction): Broadcaster[T]['public'] {
        return this.connector.listen(channel, event, callback);
    }

    /**
     * Get a private channel instance by name.
     */
    private(channel: string): Broadcaster[T]['private'] {
        return this.connector.privateChannel(channel);
    }

    /**
     * Get a private encrypted channel instance by name.
     */
    encryptedPrivate(channel: string): Broadcaster[T]['encrypted'] {
        if (this.connectorSupportsEncryptedPrivateChannels(this.connector)) {
            return this.connector.encryptedPrivateChannel(channel);
        }

        throw new Error(
            `Broadcaster ${typeof this.options.broadcaster} ${String(
                this.options.broadcaster
            )} does not support encrypted private channels.`
        );
    }

    private connectorSupportsEncryptedPrivateChannels(
        connector: unknown
    ): connector is PusherConnector<any> | NullConnector {
        return connector instanceof PusherConnector || connector instanceof NullConnector;
    }

    /**
     * Get the Socket ID for the connection.
     */
    socketId(): string | undefined {
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
        Vue.http.interceptors.push((request: Record<any, any>, next: CallableFunction) => {
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
        axios.interceptors.request.use((config: Record<any, any>) => {
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
            jQuery.ajaxPrefilter((_options: any, _originalOptions: any, xhr: Record<any, any>) => {
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
        document.addEventListener('turbo:before-fetch-request', (event: Record<any, any>) => {
            event.detail.fetchOptions.headers['X-Socket-Id'] = this.socketId();
        });
    }
}

/**
 * Export channel classes for TypeScript.
 */
export { Connector, Channel, type PresenceChannel };

export { EventFormatter } from './util';

/**
 * Specifies the broadcaster
 */
export type Broadcaster = {
    reverb: {
        connector: PusherConnector<'reverb'>;
        public: PusherChannel<'reverb'>;
        private: PusherPrivateChannel<'reverb'>;
        encrypted: PusherEncryptedPrivateChannel<'reverb'>;
        presence: PusherPresenceChannel<'reverb'>;
    };
    pusher: {
        connector: PusherConnector<'pusher'>;
        public: PusherChannel<'pusher'>;
        private: PusherPrivateChannel<'pusher'>;
        encrypted: PusherEncryptedPrivateChannel<'pusher'>;
        presence: PusherPresenceChannel<'pusher'>;
    };
    'socket.io': {
        connector: SocketIoConnector;
        public: SocketIoChannel;
        private: SocketIoPrivateChannel;
        encrypted: never;
        presence: SocketIoPresenceChannel;
    };
    null: {
        connector: NullConnector;
        public: NullChannel;
        private: NullPrivateChannel;
        encrypted: NullEncryptedPrivateChannel;
        presence: NullPresenceChannel;
    };
    function: {
        connector: any;
        public: any;
        private: any;
        encrypted: any;
        presence: any;
    };
};

type Constructor<T = {}> = new (...args: any[]) => T;

export type BroadcastDriver = Exclude<keyof Broadcaster, 'function'>;

export type EchoOptions<TBroadcaster extends keyof Broadcaster> = {
    /**
     * The broadcast connector.
     */
    broadcaster: TBroadcaster extends 'function'
        ? Constructor<InstanceType<Broadcaster[TBroadcaster]['connector']>>
        : TBroadcaster;

    auth?: {
        headers: Record<string, string>;
    };
    authEndpoint?: string;
    userAuthentication?: {
        endpoint: string;
        headers: Record<string, string>;
    };
    csrfToken?: string | null;
    bearerToken?: string | null;
    host?: string | null;
    key?: string | null;
    namespace?: string | false;

    [key: string]: any;
};
