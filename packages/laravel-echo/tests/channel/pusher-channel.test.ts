import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Pusher from "pusher-js";
import { AddressInfo, WebSocketServer } from 'ws';
import { PusherConnector } from "../../src/connector";

describe("PusherChannel", () => {
    let wss: WebSocketServer;
    let connector: PusherConnector<'null'>;
    
    beforeEach(() => {
        wss = new WebSocketServer({ port: 0 });

        const { port } = wss.address() as AddressInfo;

        const pusher = new Pusher('test-key', {
            wsHost: '127.0.0.1',
            wsPort: port,
            forceTLS: false,
            enabledTransports: ['ws'],
            disableStats: true,
            cluster: 'test'
        });

        connector = new PusherConnector({
            client: pusher,
            broadcaster: "null",
            namespace: false
        });
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => wss.close(() => resolve()));
    });

    test("can remove channel listeners by context", () => {
        const channel = connector.channel("some.name");

        const l1 = vi.fn();
        const l2 = vi.fn();
        const l3 = vi.fn();
        const l4 = vi.fn();
        const context = "foobar";

        channel.listen("MyEvent", l1, context);
        connector.listen("some.name", "MyEvent", l2, context);
        channel.listen("MyEvent", l3);
        connector.listen("some.name", "MyEvent", l4);

        channel.stopListeningForContext(context);

        channel.subscription.emit("MyEvent", {});

        expect(l1).not.toHaveBeenCalled();
        expect(l2).not.toHaveBeenCalled();
        expect(l3).toHaveBeenCalled();
        expect(l4).toHaveBeenCalled();
    });
});