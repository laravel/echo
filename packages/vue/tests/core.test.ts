import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

describe("entry points", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.doUnmock("pusher-js");
    });

    it("loads the core entry point without pusher-js", async () => {
        vi.doMock("pusher-js", () => {
            throw new Error("pusher-js must not be imported");
        });

        const { configureEcho, echo } = await import("../src/core");

        configureEcho({ broadcaster: "null" });

        expect(echo().options.broadcaster).toBe("null");
        expect(echo().options.Pusher).toBeUndefined();
    });

    it("keeps pusher-js as the default client in the default entry point", async () => {
        const { default: Pusher } = await import("pusher-js");
        const { configureEcho, echo } = await import("../src/index");

        configureEcho({ broadcaster: "reverb", key: "app-key" });

        expect(echo().options.Pusher).toBe(Pusher);
    });

    it("prefers the Pusher client passed to configureEcho", async () => {
        class CustomPusher {}
        const { configureEcho, echo } = await import("../src/index");

        configureEcho({ broadcaster: "null", Pusher: CustomPusher as never });

        expect(echo().options.Pusher).toBe(CustomPusher);
    });

    it("shares the Echo instance between both entry points", async () => {
        const defaultEntry = await import("../src/index");
        const coreEntry = await import("../src/core");

        defaultEntry.configureEcho({ broadcaster: "null" });

        expect(coreEntry.echoIsConfigured()).toBe(true);
        expect(coreEntry.echo()).toBe(defaultEntry.echo());
    });
});
