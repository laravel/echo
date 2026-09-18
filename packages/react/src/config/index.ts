import Echo, {
    type BroadcastDriver,
    type Broadcaster,
    type EchoOptions,
} from "laravel-echo";
import Pusher from "pusher-js";
import type { ConfigDefaults } from "../types";

/**
 * The Echo constructor argument, which allows a custom connector class as the broadcaster.
 */
type EchoConfig = ConstructorParameters<typeof Echo<keyof Broadcaster>>[0];

let echoInstance: Echo<keyof Broadcaster> | null = null;
let echoConfig: EchoConfig | null = null;

const getEchoInstance = <T extends keyof Broadcaster>(): Echo<T> => {
    if (echoInstance) {
        return echoInstance as Echo<T>;
    }

    if (!echoConfig) {
        throw new Error(
            "Echo has not been configured. Please call `configureEcho()`.",
        );
    }

    echoConfig.Pusher ??= Pusher;

    echoInstance = new Echo<keyof Broadcaster>(echoConfig);

    return echoInstance as Echo<T>;
};

/**
 * Configure the Echo instance with sensible defaults.
 *
 * `broadcaster` accepts a built-in driver name or a custom connector class.
 *
 * @link https://laravel.com/docs/broadcasting#client-side-installation
 */
export const configureEcho = <T extends keyof Broadcaster>(
    config: EchoOptions<T>,
): void => {
    const defaults: ConfigDefaults<BroadcastDriver> = {
        reverb: {
            broadcaster: "reverb",
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT,
            wssPort: import.meta.env.VITE_REVERB_PORT,
            forceTLS:
                (import.meta.env.VITE_REVERB_SCHEME ?? "https") === "https",
            enabledTransports: ["ws", "wss"],
        },
        pusher: {
            broadcaster: "pusher",
            key: import.meta.env.VITE_PUSHER_APP_KEY,
            cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
            forceTLS: true,
            wsHost: import.meta.env.VITE_PUSHER_HOST,
            wsPort: import.meta.env.VITE_PUSHER_PORT,
            wssPort: import.meta.env.VITE_PUSHER_PORT,
            enabledTransports: ["ws", "wss"],
        },
        "socket.io": {
            broadcaster: "socket.io",
            host: import.meta.env.VITE_SOCKET_IO_HOST,
        },
        mercure: {
            broadcaster: "mercure",
            host: import.meta.env.VITE_MERCURE_HUB_URL,
        },
        null: {
            broadcaster: "null",
        },
        ably: {
            broadcaster: "pusher",
            key: import.meta.env.VITE_ABLY_PUBLIC_KEY,
            wsHost: "realtime-pusher.ably.io",
            wsPort: 443,
            disableStats: true,
            encrypted: true,
        },
    };

    // Custom connector classes have no defaults to merge in...
    const { broadcaster } = config;

    echoConfig = {
        ...(typeof broadcaster === "string" ? defaults[broadcaster] : null),
        ...config,
    } as EchoConfig;

    // Reset the instance if it was already created
    if (echoInstance) {
        echoInstance = null;
    }
};

export const echo = <
    T extends keyof Broadcaster = BroadcastDriver,
>(): Echo<T> => getEchoInstance<T>();

export const echoIsConfigured = () => echoConfig !== null;
