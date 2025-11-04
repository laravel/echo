import type { InternalAxiosRequestConfig } from "axios";
import {
    Channel,
    NullChannel,
    NullEncryptedPrivateChannel,
    NullPresenceChannel,
    NullPrivateChannel,
    PusherChannel,
    PusherEncryptedPrivateChannel,
    PusherPresenceChannel,
    PusherPrivateChannel,
    SocketIoChannel,
    SocketIoPresenceChannel,
    SocketIoPrivateChannel,
    type PresenceChannel,
} from "./channel";
import {
    Connector,
    NullConnector,
    PusherConnector,
    SocketIoConnector,
    type PusherOptions,
} from "./connector";
import { isConstructor } from "./util";

/**
 * This class is the primary API for interacting with broadcasting.
 */
export default class Echo<T extends keyof Broadcaster> {
    /**
     * The broadcasting connector.
     */
    connector: Broadcaster[Exclude<T, "function">]["connector"];

    /**
     * The Echo options.
     */
    options: EchoOptions<T>;

    /**
     * Create a new class instance.
     */
    constructor(options: EchoOptions<T> & { broadcaster: T }) {
        this.options = options;
        this.connect();

        if (!this.options.withoutInterceptors) {
            this.registerInterceptors();
        }
    }

    /**
     * Get a channel instance by name.
     */
    channel(channel: string): Broadcaster[T]["public"] {
        return this.connector.channel(channel);
    }

    /**
     * Create a new connection.
     */
    connect(): void {
        if (this.options.broadcaster === "reverb") {
            this.connector = new PusherConnector<"reverb">({
                ...this.options,
                cluster: "",
            });
        } else if (this.options.broadcaster === "pusher") {
            this.connector = new PusherConnector<"pusher">(this.options);
        } else if (this.options.broadcaster === "ably") {
            this.connector = new PusherConnector<"pusher">({
                ...this.options,
                cluster: "",
                broadcaster: "pusher",
            });
        } else if (this.options.broadcaster === "socket.io") {
            this.connector = new SocketIoConnector(this.options);
        } else if (this.options.broadcaster === "null") {
            this.connector = new NullConnector(this.options);
        } else if (
            typeof this.options.broadcaster === "function" &&
            isConstructor(this.options.broadcaster)
        ) {
            this.connector = new this.options.broadcaster(this.options);
        } else {
            throw new Error(
                `Broadcaster ${typeof this.options.broadcaster} ${String(this.options.broadcaster)} is not supported.`,
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
    join(channel: string): Broadcaster[T]["presence"] {
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
    listen(
        channel: string,
        event: string,
        callback: CallableFunction,
    ): Broadcaster[T]["public"] {
        return this.connector.listen(channel, event, callback);
    }

    /**
     * Get a private channel instance by name.
     */
    private(channel: string): Broadcaster[T]["private"] {
        return this.connector.privateChannel(channel);
    }

    /**
     * Get a private encrypted channel instance by name.
     */
    encryptedPrivate(channel: string): Broadcaster[T]["encrypted"] {
        if (this.connectorSupportsEncryptedPrivateChannels(this.connector)) {
            return this.connector.encryptedPrivateChannel(channel);
        }

        throw new Error(
            `Broadcaster ${typeof this.options.broadcaster} ${String(
                this.options.broadcaster,
            )} does not support encrypted private channels.`,
        );
    }

    private connectorSupportsEncryptedPrivateChannels(
        connector: unknown,
    ): connector is PusherConnector<any> | NullConnector {
        return (
            connector instanceof PusherConnector ||
            connector instanceof NullConnector
        );
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
        // TODO: This package is deprecated and we should remove it in a future version.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof Vue !== "undefined" && Vue?.http) {
            this.registerVueRequestInterceptor();
        }

        if (typeof axios === "function") {
            this.registerAxiosRequestInterceptor();
        }

        if (typeof jQuery === "function") {
            this.registerjQueryAjaxSetup();
        }

        if (typeof Turbo === "object") {
            this.registerTurboRequestInterceptor();
        }
    }

    /**
     * Register a Vue HTTP interceptor to add the X-Socket-ID header.
     */
    registerVueRequestInterceptor(): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        Vue.http.interceptors.push(
            (request: Record<any, any>, next: CallableFunction) => {
                if (this.socketId()) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    request.headers.set("X-Socket-ID", this.socketId());
                }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                next();
            },
        );
    }

    /**
     * Register an Axios HTTP interceptor to add the X-Socket-ID header.
     */
    registerAxiosRequestInterceptor(): void {
        axios!.interceptors.request.use(
            (config: InternalAxiosRequestConfig<any>) => {
                if (this.socketId()) {
                    config.headers["X-Socket-Id"] = this.socketId();
                }

                return config;
            },
        );
    }

    /**
     * Register jQuery AjaxPrefilter to add the X-Socket-ID header.
     */
    registerjQueryAjaxSetup(): void {
        if (typeof jQuery.ajax != "undefined") {
            jQuery.ajaxPrefilter(
                (
                    _options: any,
                    _originalOptions: any,
                    xhr: Record<any, any>,
                ) => {
                    if (this.socketId()) {
                        xhr.setRequestHeader("X-Socket-Id", this.socketId());
                    }
                },
            );
        }
    }

    /**
     * Register the Turbo Request interceptor to add the X-Socket-ID header.
     */
    registerTurboRequestInterceptor(): void {
        document.addEventListener(
            "turbo:before-fetch-request",
            (event: Record<any, any>) => {
                event.detail.fetchOptions.headers["X-Socket-Id"] =
                    this.socketId();
            },
        );
    }
}

/**
 * Export channel classes for TypeScript.
 */
export { Channel, Connector, type PresenceChannel };

export { EventFormatter } from "./util";

type CustomOmit<T, K extends PropertyKey> = {
    [P in keyof T as Exclude<P, K>]: T[P];
};

/**
 * Specifies the broadcaster
 */
export type Broadcaster = {
    reverb: {
        connector: PusherConnector<"reverb">;
        public: PusherChannel<"reverb">;
        private: PusherPrivateChannel<"reverb">;
        encrypted: PusherEncryptedPrivateChannel<"reverb">;
        presence: PusherPresenceChannel<"reverb">;
        options: GenericOptions<"reverb"> &
            Partial<CustomOmit<PusherOptions<"reverb">, "cluster">>;
    };
    pusher: {
        connector: PusherConnector<"pusher">;
        public: PusherChannel<"pusher">;
        private: PusherPrivateChannel<"pusher">;
        encrypted: PusherEncryptedPrivateChannel<"pusher">;
        presence: PusherPresenceChannel<"pusher">;
        options: GenericOptions<"pusher"> & Partial<PusherOptions<"pusher">>;
    };
    ably: {
        connector: PusherConnector<"pusher">;
        public: PusherChannel<"pusher">;
        private: PusherPrivateChannel<"pusher">;
        encrypted: PusherEncryptedPrivateChannel<"pusher">;
        presence: PusherPresenceChannel<"pusher">;
        options: GenericOptions<"ably"> & Partial<PusherOptions<"ably">>;
    };
    "socket.io": {
        connector: SocketIoConnector;
        public: SocketIoChannel;
        private: SocketIoPrivateChannel;
        encrypted: never;
        presence: SocketIoPresenceChannel;
        options: GenericOptions<"socket.io">;
    };
    null: {
        connector: NullConnector;
        public: NullChannel;
        private: NullPrivateChannel;
        encrypted: NullEncryptedPrivateChannel;
        presence: NullPresenceChannel;
        options: GenericOptions<"null">;
    };
    function: {
        connector: any;
        public: any;
        private: any;
        encrypted: any;
        presence: any;
        options: GenericOptions<"function">;
    };
};

type Constructor<T = {}> = new (...args: any[]) => T;

export type BroadcastDriver = Exclude<keyof Broadcaster, "function">;

type GenericOptions<TBroadcaster extends keyof Broadcaster> = {
    /**
     * The broadcast connector.
     */
    broadcaster: TBroadcaster extends "function"
        ? Constructor<InstanceType<Broadcaster[TBroadcaster]["connector"]>>
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
    withoutInterceptors?: boolean;

    [key: string]: any;
};

export type EchoOptions<TBroadcaster extends keyof Broadcaster> =
    Broadcaster[TBroadcaster]["options"];
