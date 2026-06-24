import type { AxiosStatic } from "axios";
import type { JQueryStatic } from "jquery";
import type Pusher from "pusher-js";
import type { SocketIoFunction } from "../src/socketio-types";

declare global {
    interface Window {
        Laravel?: {
            csrfToken?: string;
        };

        io?: SocketIoFunction;
        Pusher?: typeof Pusher;

        Vue?: any;
        axios?: AxiosStatic;
        jQuery?: JQueryStatic;
        Turbo?: object;
    }

    const Vue: any | undefined;
    const axios: AxiosStatic | undefined;
    const jQuery: JQueryStatic | undefined;
    const Turbo: object | undefined;
}
