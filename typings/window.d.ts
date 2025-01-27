import type { io } from 'socket.io-client';
import type Pusher from 'pusher-js';

export {};

declare global {
    interface Window {
        Laravel?: {
            csrfToken?: string;
        };

        io?: typeof io;

        Pusher?: typeof Pusher;
    }
}
