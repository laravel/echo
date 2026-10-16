import type { Socket } from "socket.io-client";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { SocketIoChannel } from "../../src/channel";
import { Connector } from "../../src/connector";

describe("SocketIoChannel", () => {
    let channel: SocketIoChannel;
    let socket: Socket;

    beforeEach(() => {
        const channelName = "some.channel";
        let listeners: any[] = [];
        socket = {
            emit: (event: any, data: unknown) => {
                listeners
                    .filter(([e]) => e === event)
                    .forEach(([, fn]) => fn(channelName, data));
            },
            on: (event: any, fn): any => listeners.push([event, fn]),
            removeListener: (event: any, fn: any) => {
                listeners = listeners.filter(([e, f]) =>
                    !fn ? e !== event : e !== event || f !== fn,
                );
            },
        } as Socket;

        channel = new SocketIoChannel(socket, channelName, {
            broadcaster: "socket.io",
            ...Connector._defaultOptions,
            namespace: false,
        });
    });

    test("triggers all listeners for an event", () => {
        const l1 = vi.fn();
        const l2 = vi.fn();
        const l3 = vi.fn();
        channel.listen("MyEvent", l1);
        channel.listen("MyEvent", l2);
        channel.listen("MyOtherEvent", l3);

        socket.emit("MyEvent", {});

        expect(l1).toHaveBeenCalled();
        expect(l2).toHaveBeenCalled();
        expect(l3).not.toHaveBeenCalled();

        socket.emit("MyOtherEvent", {});

        expect(l3).toHaveBeenCalled();
    });

    test("can remove a listener for an event", () => {
        const l1 = vi.fn();
        const l2 = vi.fn();
        const l3 = vi.fn();
        channel.listen("MyEvent", l1);
        channel.listen("MyEvent", l2);
        channel.listen("MyOtherEvent", l3);

        channel.stopListening("MyEvent", l1);

        socket.emit("MyEvent", {});

        expect(l1).not.toHaveBeenCalled();
        expect(l2).toHaveBeenCalled();
        expect(l3).not.toHaveBeenCalled();

        socket.emit("MyOtherEvent", {});

        expect(l3).toHaveBeenCalled();
    });

    test("can remove all listeners for an event", () => {
        const l1 = vi.fn();
        const l2 = vi.fn();
        const l3 = vi.fn();
        channel.listen("MyEvent", l1);
        channel.listen("MyEvent", l2);
        channel.listen("MyOtherEvent", l3);

        channel.stopListening("MyEvent");

        socket.emit("MyEvent", {});

        expect(l1).not.toHaveBeenCalled();
        expect(l2).not.toHaveBeenCalled();
        expect(l3).not.toHaveBeenCalled();

        socket.emit("MyOtherEvent", {});

        expect(l3).toHaveBeenCalled();
    });
});
