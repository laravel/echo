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
        const channel = echo.acquire("user.1", "private");

        expect(echo.acquire("user.1", "private")).toBe(channel);
        expect(client.subscribe).toHaveBeenCalledTimes(1);
        expect(echo.release("user.1", "presence")).toBe(false);
        expect(echo.release("user.1", "private")).toBe(false);
        expect(client.unsubscribe).not.toHaveBeenCalled();

        expect(echo.release("user.1", "private")).toBe(true);
        expect(client.unsubscribe).toHaveBeenCalledWith("private-user.1");
    });

    test("it keeps a channel joined before it was acquired with keepExisting", () => {
        const { echo, client } = makePusherEcho();

        echo.private("user.1");
        echo.acquire("user.1", "private");
        echo.acquire("user.2", "private");

        expect(echo.release("user.1", "private", { keepExisting: true })).toBe(
            false,
        );
        expect(echo.release("user.2", "private", { keepExisting: true })).toBe(
            true,
        );
        expect(client.unsubscribe).toHaveBeenCalledTimes(1);
        expect(client.unsubscribe).toHaveBeenCalledWith("private-user.2");
    });

    test("it keeps a channel other code joined again after it was left with keepExisting", () => {
        const { echo, client } = makePusherEcho();

        echo.acquire("user.1", "private");
        echo.leave("user.1");

        const joined = echo.private("user.1");

        expect(echo.release("user.1", "private", { keepExisting: true })).toBe(
            false,
        );
        expect(client.unsubscribe).toHaveBeenCalledTimes(1);
        expect(echo.connector.channels["private-user.1"]).toBe(joined);
    });

    test("it acquires a fresh channel after the channel was left", () => {
        const { echo } = makePusherEcho();
        const stale = echo.acquire("user.1", "private");

        echo.leaveChannel("private-user.1");

        const fresh = echo.acquire("user.1", "private");

        expect(fresh).not.toBe(stale);
        expect(echo.connector.channels["private-user.1"]).toBe(fresh);
    });

    test("it leaves every variant with leaveAll and counts without leaving with leave: false", () => {
        const { echo, client } = makePusherEcho();

        echo.private("chat");
        echo.acquire("chat", "presence");
        echo.acquire("user.1", "private");

        expect(echo.release("user.1", "private", { leave: false })).toBe(true);
        expect(client.unsubscribe).not.toHaveBeenCalled();

        expect(echo.release("chat", "presence", { leaveAll: true })).toBe(true);
        expect(client.unsubscribe).toHaveBeenCalledWith("presence-chat");
        expect(client.unsubscribe).toHaveBeenCalledWith("private-chat");
    });

    test("it can retry a release whose leave failed", () => {
        const { echo, client } = makePusherEcho();

        vi.spyOn(echo, "leaveChannel").mockImplementationOnce(() => {
            throw new Error("offline");
        });

        echo.acquire("user.1", "private");

        expect(() =>
            echo.release("user.1", "private", { keepExisting: true }),
        ).toThrow("offline");

        echo.acquire("user.1", "private");

        expect(echo.release("user.1", "private", { keepExisting: true })).toBe(
            true,
        );
        expect(client.unsubscribe).toHaveBeenCalledWith("private-user.1");
    });
});
