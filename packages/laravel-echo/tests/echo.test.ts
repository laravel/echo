import { describe, expect, test } from "vitest";
import { NullConnector } from "../src/connector";
import Echo from "../src/echo";

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
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                new Echo({ broadcaster: () => {}, withoutInterceptors: true }),
        ).not.toThrow("Broadcaster function is not supported.");
    });

    test("it will throw error for unsupported driver", () => {
        expect(
            // @ts-ignore
            // eslint-disable-next-line
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
});
