import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEchoModule = async () => import("../src/hooks/use-echo");
const getConfigModule = async () => import("../src/config/index");

// Regression tests for https://github.com/laravel/echo/issues/482: in
// StrictMode, React mounts, cleans up, and remounts effects. The mock tracks
// real bind/unbind semantics so we can tell whether a notification
// listener is actually bound after StrictMode's mount -> cleanup -> remount.
vi.mock("laravel-echo", () => {
    const notificationListeners = new Set<(payload: unknown) => void>();
    const eventListeners = new Map<string, Set<(payload: unknown) => void>>();

    const mockPrivateChannel = {
        leaveChannel: vi.fn(),
        listen: vi.fn((event: string, cb: (payload: unknown) => void) => {
            if (!eventListeners.has(event)) {
                eventListeners.set(event, new Set());
            }
            eventListeners.get(event)!.add(cb);
        }),
        stopListening: vi.fn(
            (event: string, cb: (payload: unknown) => void) => {
                eventListeners.get(event)?.delete(cb);
            },
        ),
        notification: vi.fn((cb: (payload: unknown) => void) => {
            notificationListeners.add(cb);
        }),
        stopListeningForNotification: vi.fn(
            (cb: (payload: unknown) => void) => {
                notificationListeners.delete(cb);
            },
        ),
    };

    const Echo = vi.fn() as ReturnType<typeof vi.fn> & {
        __notificationListeners: typeof notificationListeners;
        __eventListeners: typeof eventListeners;
    };

    Echo.prototype.private = vi.fn(() => mockPrivateChannel);
    Echo.prototype.channel = vi.fn(() => mockPrivateChannel);
    Echo.prototype.join = vi.fn(() => mockPrivateChannel);
    Echo.prototype.leave = vi.fn();
    Echo.prototype.leaveChannel = vi.fn();
    Echo.prototype.connectionStatus = vi.fn(() => "connected");
    Echo.prototype.socketId = vi.fn(() => undefined);
    Echo.prototype.connector = { onConnectionChange: vi.fn(() => () => {}) };

    Echo.__notificationListeners = notificationListeners;
    Echo.__eventListeners = eventListeners;

    return { default: Echo };
});

describe("hooks under React.StrictMode", () => {
    beforeEach(async () => {
        vi.resetModules();

        const configModule = await getConfigModule();
        configModule.configureEcho({ broadcaster: "null" });
    });

    it("useEchoNotification invokes the callback after StrictMode remount", async () => {
        const echoModule = await getEchoModule();
        const EchoMock = (await import("laravel-echo")).default as unknown as {
            __notificationListeners: Set<(payload: unknown) => void>;
        };

        const mockCallback = vi.fn();

        renderHook(
            () =>
                echoModule.useEchoNotification("orders", mockCallback, [
                    "OrderShipped",
                ]),
            { wrapper: StrictMode },
        );

        // Simulate the server broadcasting a notification: fire every listener
        // that is still bound on the channel.
        act(() => {
            EchoMock.__notificationListeners.forEach((cb) =>
                cb({ type: "OrderShipped" }),
            );
        });

        expect(EchoMock.__notificationListeners.size).toBeGreaterThan(0);
        expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it("useEcho invokes the callback after StrictMode remount (control)", async () => {
        const echoModule = await getEchoModule();
        const EchoMock = (await import("laravel-echo")).default as unknown as {
            __eventListeners: Map<string, Set<(payload: unknown) => void>>;
        };

        const mockCallback = vi.fn();

        renderHook(
            () => echoModule.useEcho("orders", "OrderShipped", mockCallback),
            { wrapper: StrictMode },
        );

        act(() => {
            EchoMock.__eventListeners
                .get("OrderShipped")
                ?.forEach((cb) => cb({ order: 1 }));
        });

        expect(mockCallback).toHaveBeenCalledTimes(1);
    });
});
