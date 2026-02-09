/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PUSHER_APP_CLUSTER: string;
    readonly VITE_PUSHER_APP_KEY: string;
    readonly VITE_PUSHER_HOST: string;
    readonly VITE_PUSHER_PORT: number;

    readonly VITE_REVERB_HOST: string;
    readonly VITE_REVERB_APP_KEY: string;
    readonly VITE_REVERB_PORT: number;
    readonly VITE_REVERB_SCHEME: string;

    readonly VITE_SOCKET_IO_HOST: string;

    readonly VITE_ABLY_PUBLIC_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
