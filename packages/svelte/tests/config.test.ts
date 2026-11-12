import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

describe("echo helper", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("throws error when Echo is not configured", async () => {
        const { echo } = await import("../src/config");

        expect(() => echo()).toThrow("Echo has not been configured");
    });

    it("creates Echo instance with proper configuration", async () => {
        const { configureEcho, echo } = await import("../src/config");

        configureEcho({
            broadcaster: "null",
        });

        expect(echo()).toBeDefined();
        expect(echo().options.broadcaster).toBe("null");
    });

    it("checks if Echo is configured", async () => {
        const { configureEcho, echoIsConfigured } =
            await import("../src/config");

        expect(echoIsConfigured()).toBe(false);

        configureEcho({
            broadcaster: "null",
        });

        expect(echoIsConfigured()).toBe(true);
    });

    it("creates Echo instance from a custom connector class", async () => {
        const { configureEcho, echo } = await import("../src/config");

        class CustomConnector {
            options: unknown;

            constructor(options: unknown) {
                this.options = options;
            }
        }

        configureEcho({
            broadcaster: CustomConnector,
            authEndpoint: "/custom/auth",
        });

        const instance = echo();

        expect(instance.connector).toBeInstanceOf(CustomConnector);
        expect(instance.options.authEndpoint).toBe("/custom/auth");
    });

    it("configures a non-Pusher broadcaster without requiring pusher-js", async () => {
        const { configureEcho, echo } = await import("../src/config");

        configureEcho({
            broadcaster: "mercure",
            host: "http://localhost/.well-known/mercure",
        });

        expect(echo()).toBeDefined();
        expect(echo().options.broadcaster).toBe("mercure");
        expect(echo().options.Pusher).toBeUndefined();
    });

    it("uses a Pusher client passed to configureEcho", async () => {
        const { configureEcho, echo } = await import("../src/config");

        class FakePusher {
            constructor(
                public key: string,
                public options: unknown,
            ) {}
        }

        configureEcho<"reverb">({
            broadcaster: "reverb",
            key: "app-key",
            Pusher: FakePusher as never,
        });

        const instance = echo<"reverb">();

        expect(instance.options.Pusher).toBe(FakePusher);
        expect(instance.connector.pusher).toBeInstanceOf(FakePusher);
    });
});
