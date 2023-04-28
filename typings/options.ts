export type BroadcasterOption =
    | "pusher"
    | "socket.io"
    | "null"
    | ((option: Options) => void);

export type TransportOption = "ws" | "wss";

/**
 * The options available in echo
 */
export type Options = {
    /**
     * Pusher client.
     */
    Pusher?: (key: Options["key"], options: Options) => void;

    broadcaster?: BroadcasterOption;

    key?: string | null;

    auth?: {
        headers?: {
            Authorization?: string;
            [key: string]: string;
        };
    };

    authEndpoint?: string;

    userAuthentication?: {
        endpoint?: string;
        headers?: Record<string, any>;
    };

    csrfToken?: string | null;

    bearerToken?: string | null;

    host?: string | null;

    namespace?: string | null;

    wsHost?: string;

    wsPort?: number;

    wssPort?: number;

    forceTLS?: boolean;

    enabledTransports?: Array<TransportOption>;

    encrypted?: boolean;

    cluster?: string;

    withoutInterceptors?: boolean;

    client?: string;
};
