import Echo, { type BroadcastDriver, type EchoOptions } from "laravel-echo";
import Pusher from "pusher-js";
import type { ConfigDefaults } from "../types";

let echoInstance: Echo<BroadcastDriver> | null = null;
let echoConfig: EchoOptions<BroadcastDriver> | null = null;

const getEchoInstance = <T extends BroadcastDriver>(): Echo<T> => {
    if (echoInstance) {
        return echoInstance as Echo<T>;
    }

    if (!echoConfig) {
        throw new Error(
            "Echo has not been configured. Please call `configureEcho()`.",
        );
    }

    echoConfig.Pusher ??= Pusher;

    echoInstance = new Echo(echoConfig);

    return echoInstance as Echo<T>;
};

/**
 * Configure the Echo instance with sensible defaults.
 *
 * @link https://laravel.com/docs/broadcasting#client-side-installation
 */
export const configureEcho = <T extends BroadcastDriver>(
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

    echoConfig = {
        ...defaults[config.broadcaster],
        ...config,
    } as EchoOptions<BroadcastDriver>;

    // Reset the instance if it was already created
    if (echoInstance) {
        echoInstance = null;
    }
};

export const echo = <T extends BroadcastDriver>(): Echo<T> =>
    getEchoInstance<T>();

export const echoIsConfigured = () => echoConfig !== null;
