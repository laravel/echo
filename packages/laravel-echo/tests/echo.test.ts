import type Pusher from "pusher-js";
import { describe, expect, test, vi } from "vite-plus/test";
import { NullConnector } from "../src/connector";
import Echo from "../src/echo";

function makePusherEcho() {
    const client = {
        subscribe: vi.fn(() => ({ bind: vi.fn(), unbind: vi.fn() })),
        unsubscribe: vi.fn(),
    } as unknown as Pusher;

    return {
        client,
        echo: new Echo({
            broadcaster: "pusher",
            key: "key",
            client,
            withoutInterceptors: true,
        }),
    };
}

describe("Echo", () => {
    test("it will not throw error for supported driver", () => {
        expect(
            () =>
                new Echo({ broadcaster: "reverb", withoutInterceptors: true }),
        ).not.toThrow("Broadcaster string reverb is not supported.");

        expect(
            () =>
                new Echo({ broadcaster: "pusher", withoutInterceptors: true }),
        ).not.toThrow("Broadcaster string pusher is not supported.");

        expect(
            () =>
                new Echo({
                    broadcaster: "socket.io",
                    withoutInterceptors: true,
                }),
        ).not.toThrow("Broadcaster string socket.io is not supported.");

        expect(
            () =>
                new Echo({
                    broadcaster: "mercure",
                    host: "https://hub.example.com/.well-known/mercure",
                    withoutInterceptors: true,
                }),
        ).not.toThrow("Broadcaster string mercure is not supported.");

        expect(
            () => new Echo({ broadcaster: "null", withoutInterceptors: true }),
        ).not.toThrow("Broadcaster string null is not supported.");
        expect(
            () =>
                new Echo({
                    broadcaster: NullConnector,
                    withoutInterceptors: true,
                }),
        ).not.toThrow();
        expect(
            () =>
                // @ts-expect-error a plain function is not a connector constructor
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                new Echo({ broadcaster: () => {}, withoutInterceptors: true }),
        ).not.toThrow("Broadcaster function is not supported.");
    });

    test("it will throw error for unsupported driver", () => {
        expect(
            // @ts-expect-error unsupported broadcaster string
            () => new Echo({ broadcaster: "foo", withoutInterceptors: true }),
        ).toThrow("Broadcaster string foo is not supported.");
    });

    test("it can get connection status", () => {
        const echo = new Echo({
            broadcaster: "null",
            withoutInterceptors: true,
        });

        expect(echo.connectionStatus()).toBe("connected");
    });

    test("it shares one channel and leaves it after the last release", () => {
        const { echo, client } = makePusherEcho();
        const first = echo.share("user.1", "private");
        const second = echo.share("user.1", "private");

        expect(second.channel).toBe(first.channel);
        expect(client.subscribe).toHaveBeenCalledTimes(1);
        expect(first.release()).toBe(false);
        expect(client.unsubscribe).not.toHaveBeenCalled();

        expect(second.release()).toBe(true);
        expect(client.unsubscribe).toHaveBeenCalledWith("private-user.1");
    });

    test("it ignores a second release from the same handle", () => {
        const { echo, client } = makePusherEcho();
        const first = echo.share("user.1", "private");

        echo.share("user.1", "private");

        expect(first.release()).toBe(false);
        expect(first.release()).toBe(false);
        expect(client.unsubscribe).not.toHaveBeenCalled();
    });

    test("it leaves a shared channel even when it was joined before it was shared", () => {
        const { echo, client } = makePusherEcho();

        echo.private("user.1");

        expect(echo.share("user.1", "private").release()).toBe(true);
        expect(client.unsubscribe).toHaveBeenCalledWith("private-user.1");
    });

    test("it shares a fresh channel after the channel was left", () => {
        const { echo } = makePusherEcho();
        const stale = echo.share("user.1", "private");

        echo.leaveChannel("private-user.1");

        const fresh = echo.share("user.1", "private");

        expect(fresh.channel).not.toBe(stale.channel);
        expect(echo.connector.channels["private-user.1"]).toBe(fresh.channel);
    });

    test("it leaves every variant except the ones still held", () => {
        const { echo, client } = makePusherEcho();

        echo.channel("orders.1");
        echo.private("orders.1");
        const presence = echo.share("orders.1", "presence");

        echo.leaveUnheld("orders.1");

        expect(client.unsubscribe).toHaveBeenCalledWith("orders.1");
        expect(client.unsubscribe).toHaveBeenCalledWith("private-orders.1");
        expect(client.unsubscribe).not.toHaveBeenCalledWith(
            "presence-orders.1",
        );
        expect(echo.connector.channels["presence-orders.1"]).toBe(
            presence.channel,
        );

        expect(presence.release()).toBe(true);
        expect(client.unsubscribe).toHaveBeenCalledWith("presence-orders.1");
    });
});
