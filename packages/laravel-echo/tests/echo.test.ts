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

    test("it does not share auth headers between instances", () => {
        const first = new Echo({
            broadcaster: "null",
            bearerToken: "first-token",
            withoutInterceptors: true,
        });

        const second = new Echo({
            broadcaster: "null",
            withoutInterceptors: true,
        });

        expect(first.connector.options.auth.headers).toEqual({
            Authorization: "Bearer first-token",
        });
        expect(second.connector.options.auth.headers).toEqual({});
        expect(second.connector.options.userAuthentication.headers).toEqual({});
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
});
