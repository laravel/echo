import { renderHook } from "@testing-library/react";
import Echo from "laravel-echo";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getEchoModule = async () => import("../src/hooks/use-echo");
const getConfigModule = async () => import("../src/config/index");

vi.mock("laravel-echo", () => {
    const mockPrivateChannel = {
        leaveChannel: vi.fn(),
        listen: vi.fn(),
        stopListening: vi.fn(),
        notification: vi.fn(),
        stopListeningForNotification: vi.fn(),
    };

    const mockPublicChannel = {
        leaveChannel: vi.fn(),
        listen: vi.fn(),
        stopListening: vi.fn(),
    };

    const mockPresenceChannel = {
        leaveChannel: vi.fn(),
        listen: vi.fn(),
        stopListening: vi.fn(),
        here: vi.fn(),
        joining: vi.fn(),
        leaving: vi.fn(),
        whisper: vi.fn(),
    };

    const Echo = vi.fn();

    Echo.prototype.private = vi.fn(() => mockPrivateChannel);
    Echo.prototype.channel = vi.fn(() => mockPublicChannel);
    Echo.prototype.encryptedPrivate = vi.fn();
    Echo.prototype.listen = vi.fn();
    Echo.prototype.leave = vi.fn();
    Echo.prototype.leaveChannel = vi.fn();
    Echo.prototype.leaveAllChannels = vi.fn();
    Echo.prototype.join = vi.fn(() => mockPresenceChannel);
    Echo.prototype.connectionStatus = vi.fn(() => "connected");

    return { default: Echo };
});

describe("without echo configured", async () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("throws error when Echo is not configured", async () => {
        const echoModule = await getEchoModule();
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        expect(() =>
            renderHook(() =>
                echoModule.useEcho(
                    channelName,
                    event,
                    mockCallback,
                    [],
                    "private",
                ),
            ),
        ).toThrow("Echo has not been configured");
    });
});

describe("useEcho hook", async () => {
    let echoModule: typeof import("../src/hooks/use-echo");
    let configModule: typeof import("../src/config/index");
    let echoInstance: Echo<"null">;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });

        echoModule = await getEchoModule();
        configModule = await getConfigModule();

        configModule.configureEcho({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a channel and listens for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");
        expect(typeof result.current.leave).toBe("function");

        expect(result.current).toHaveProperty("leave");
        expect(typeof result.current.leaveChannel).toBe("function");
    });

    it("handles multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        const { result, unmount } = renderHook(() =>
            echoModule.useEcho(channelName, events, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");

        expect(echoInstance.private).toHaveBeenCalledWith(channelName);

        const channel = echoInstance.private(channelName);

        expect(channel.listen).toHaveBeenCalledWith(events[0], mockCallback);
        expect(channel.listen).toHaveBeenCalledWith(events[1], mockCallback);

        expect(() => unmount()).not.toThrow();

        expect(channel.stopListening).toHaveBeenCalledWith(
            events[0],
            mockCallback,
        );
        expect(channel.stopListening).toHaveBeenCalledWith(
            events[1],
            mockCallback,
        );
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        expect(echoInstance.private).toHaveBeenCalled();

        expect(() => unmount()).not.toThrow();

        expect(echoInstance.leaveChannel).toHaveBeenCalled();
    });

    it("won't subscribe multiple times to the same channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount: unmount1 } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        const { unmount: unmount2 } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        expect(echoInstance.private).toHaveBeenCalledTimes(1);

        expect(() => unmount1()).not.toThrow();

        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        expect(() => unmount2()).not.toThrow();

        expect(echoInstance.leaveChannel).toHaveBeenCalled();
    });

    it("will register callbacks for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        expect(echoInstance.private).toHaveBeenCalledWith(channelName);

        expect(echoInstance.private(channelName).listen).toHaveBeenCalledWith(
            event,
            mockCallback,
        );
    });

    it("can leave a channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        result.current.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            "private-" + channelName,
        );
    });

    it("can leave all channel variations", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        result.current.leave();

        expect(echoInstance.leave).toHaveBeenCalledWith(channelName);
    });

    it("can connect to a public channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback, [], "public"),
        );

        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        result.current.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("can manually start listening to events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        const channel = echoInstance.private(channelName);

        expect(channel.listen).toHaveBeenCalledWith(event, mockCallback);

        result.current.stopListening();

        expect(channel.stopListening).toHaveBeenCalledWith(event, mockCallback);

        result.current.listen();

        expect(channel.listen).toHaveBeenCalledWith(event, mockCallback);
    });

    it("can manually stop listening to events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        result.current.stopListening();

        const channel = echoInstance.private(channelName);
        expect(channel.stopListening).toHaveBeenCalledWith(event, mockCallback);
    });

    it("stopListening is a no-op when not listening", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        result.current.stopListening();
        result.current.stopListening();

        const channel = echoInstance.private(channelName);
        expect(channel.stopListening).toHaveBeenCalledTimes(1);
    });

    it("listen is a no-op when already listening", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        result.current.listen();

        const channel = echoInstance.private(channelName);
        expect(channel.listen).toHaveBeenCalledTimes(1);
    });

    it("events and listeners are optional", async () => {
        const channelName = "test-channel";

        const { result } = renderHook(() => echoModule.useEcho(channelName));

        expect(result.current).toHaveProperty("channel");
        expect(result.current.channel).not.toBeNull();
    });

    it("updates callback when dependencies change", async () => {
        const channelName = "test-channel";
        const event = "test-event";
        let dependency = "value1";
        const mockCallback1 = vi.fn();
        const mockCallback2 = vi.fn();

        const { rerender } = renderHook(
            ({ deps, callback }) =>
                echoModule.useEcho(channelName, event, callback, deps),
            {
                initialProps: {
                    deps: [dependency],
                    callback: mockCallback1,
                },
            },
        );

        const channel = echoInstance.private(channelName);
        const firstCallback = vi.mocked(channel.listen).mock.calls[0][1];

        expect(firstCallback).toBe(mockCallback1);

        dependency = "value2";
        rerender({ deps: [dependency], callback: mockCallback2 });

        const secondCallback = vi.mocked(channel.listen).mock.calls[
            vi.mocked(channel.listen).mock.calls.length - 1
        ][1];

        expect(secondCallback).toBe(mockCallback2);
    });

    it("maintains callback stability when dependencies don't change", async () => {
        const channelName = "test-channel";
        const event = "test-event";
        const dependency = "stable-value";
        const mockCallback = vi.fn();

        const { result, rerender } = renderHook(
            ({ deps, callback }) =>
                echoModule.useEcho(channelName, event, callback, deps),
            {
                initialProps: {
                    deps: [dependency],
                    callback: mockCallback,
                },
            },
        );

        const firstResult = result.current;

        rerender({ deps: [dependency], callback: mockCallback });

        const secondResult = result.current;

        expect(firstResult.listen).toBe(secondResult.listen);
        expect(firstResult.stopListening).toBe(secondResult.stopListening);
        expect(firstResult.leaveChannel).toBe(secondResult.leaveChannel);
    });

    it("maintains return value stability when props don't change", async () => {
        const channelName = "test-channel";
        const event = "test-event";
        const mockCallback = vi.fn();
        const dependencies = ["dep1", "dep2"];

        const { result, rerender } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback, dependencies),
        );

        const firstResult = result.current;

        rerender();

        const secondResult = result.current;

        expect(firstResult).toBe(secondResult);
    });

    it("handles array event dependencies with stable eventKey", async () => {
        const channelName = "test-channel";
        const events = ["event1", "event2"];
        const mockCallback = vi.fn();

        const { rerender } = renderHook(
            ({ eventArray }) =>
                echoModule.useEcho(channelName, eventArray, mockCallback),
            {
                initialProps: { eventArray: events },
            },
        );

        const channel = echoInstance.private(channelName);
        const initialListenCalls = vi.mocked(channel.listen).mock.calls.length;

        rerender({ eventArray: [...events] });

        const afterRerenderCalls = vi.mocked(channel.listen).mock.calls.length;

        expect(afterRerenderCalls).toBe(initialListenCalls);
    });
});

describe("useEchoModel hook", async () => {
    let echoModule: typeof import("../src/hooks/use-echo");
    let configModule: typeof import("../src/config/index");
    let echoInstance: Echo<"null">;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });

        echoModule = await getEchoModule();
        configModule = await getConfigModule();

        configModule.configureEcho({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to model channel and listens for model events", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const event = "UserCreated";

        const { result } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        expect(result.current).toHaveProperty("leaveChannel");
        expect(typeof result.current.leave).toBe("function");
        expect(result.current).toHaveProperty("leave");
        expect(typeof result.current.leaveChannel).toBe("function");
    });

    it("handles multiple model events", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const events = ["UserCreated", "UserUpdated"];

        const { result, unmount } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                ["UserCreated", "UserUpdated"],
                mockCallback,
            ),
        );

        expect(result.current).toHaveProperty("leaveChannel");

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.private).toHaveBeenCalledWith(expectedChannelName);

        const channel = echoInstance.private(expectedChannelName);

        expect(channel.listen).toHaveBeenCalledWith(
            `.${events[0]}`,
            mockCallback,
        );
        expect(channel.listen).toHaveBeenCalledWith(
            `.${events[1]}`,
            mockCallback,
        );

        expect(() => unmount()).not.toThrow();

        expect(channel.stopListening).toHaveBeenCalledWith(
            `.${events[0]}`,
            mockCallback,
        );
        expect(channel.stopListening).toHaveBeenCalledWith(
            `.${events[1]}`,
            mockCallback,
        );
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const event = "UserCreated";

        const { unmount } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.private).toHaveBeenCalledWith(expectedChannelName);

        expect(() => unmount()).not.toThrow();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `private-${expectedChannelName}`,
        );
    });

    it("won't subscribe multiple times to the same model channel", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const event = "UserCreated";

        const { unmount: unmount1 } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        const { unmount: unmount2 } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.private).toHaveBeenCalledTimes(1);
        expect(echoInstance.private).toHaveBeenCalledWith(expectedChannelName);

        expect(() => unmount1()).not.toThrow();
        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        expect(() => unmount2()).not.toThrow();
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `private-${expectedChannelName}`,
        );
    });

    it("can leave a model channel", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const event = "UserCreated";

        const { result } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        result.current.leaveChannel();

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `private-${expectedChannelName}`,
        );
    });

    it("can leave all model channel variations", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const event = "UserCreated";

        const { result } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        result.current.leave();

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.leave).toHaveBeenCalledWith(expectedChannelName);
    });

    it("handles model events with dots in the name", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User.Profile";
        const identifier = "123";
        const event = "ProfileCreated";

        const { result } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.private).toHaveBeenCalledWith(expectedChannelName);

        const channel = echoInstance.private(expectedChannelName);
        expect(channel.listen).toHaveBeenCalledWith(`.${event}`, mockCallback);
    });

    it("events and listeners are optional", async () => {
        const model = "App.Models.User.Profile";
        const identifier = "123";

        const { result } = renderHook(() =>
            echoModule.useEchoModel(model, identifier),
        );

        expect(result.current).toHaveProperty("channel");
        expect(result.current.channel).not.toBeNull();
    });
});

describe("useEchoPublic hook", async () => {
    let echoModule: typeof import("../src/hooks/use-echo");
    let configModule: typeof import("../src/config/index");
    let echoInstance: Echo<"null">;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });

        echoModule = await getEchoModule();
        configModule = await getConfigModule();

        configModule.configureEcho({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a public channel and listens for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");
        expect(typeof result.current.leave).toBe("function");
        expect(result.current).toHaveProperty("leave");
        expect(typeof result.current.leaveChannel).toBe("function");
    });

    it("handles multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        const { result, unmount } = renderHook(() =>
            echoModule.useEchoPublic(channelName, events, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");

        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        const channel = echoInstance.channel(channelName);

        expect(channel.listen).toHaveBeenCalledWith(events[0], mockCallback);
        expect(channel.listen).toHaveBeenCalledWith(events[1], mockCallback);

        expect(() => unmount()).not.toThrow();

        expect(channel.stopListening).toHaveBeenCalledWith(
            events[0],
            mockCallback,
        );
        expect(channel.stopListening).toHaveBeenCalledWith(
            events[1],
            mockCallback,
        );
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        expect(() => unmount()).not.toThrow();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("won't subscribe multiple times to the same channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount: unmount1 } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        const { unmount: unmount2 } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        expect(echoInstance.channel).toHaveBeenCalledTimes(1);
        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        expect(() => unmount1()).not.toThrow();
        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        expect(() => unmount2()).not.toThrow();
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("can leave a channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        result.current.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("can leave all channel variations", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        result.current.leave();

        expect(echoInstance.leave).toHaveBeenCalledWith(channelName);
    });

    it("events and listeners are optional", async () => {
        const channelName = "test-channel";

        const { result } = renderHook(() =>
            echoModule.useEchoPublic(channelName),
        );

        expect(result.current).toHaveProperty("channel");
        expect(result.current.channel).not.toBeNull();
    });
});

describe("useEchoPresence hook", async () => {
    let echoModule: typeof import("../src/hooks/use-echo");
    let configModule: typeof import("../src/config/index");
    let echoInstance: Echo<"null">;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });

        echoModule = await getEchoModule();
        configModule = await getConfigModule();

        configModule.configureEcho({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a presence channel and listens for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");
        expect(typeof result.current.leave).toBe("function");
        expect(result.current).toHaveProperty("leave");
        expect(typeof result.current.leaveChannel).toBe("function");
        expect(result.current).toHaveProperty("channel");
        expect(result.current.channel).not.toBeNull();
        expect(typeof result.current.channel().here).toBe("function");
        expect(typeof result.current.channel().joining).toBe("function");
        expect(typeof result.current.channel().leaving).toBe("function");
        expect(typeof result.current.channel().whisper).toBe("function");
    });

    it("handles multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        const { result, unmount } = renderHook(() =>
            echoModule.useEchoPresence(channelName, events, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");

        expect(echoInstance.join).toHaveBeenCalledWith(channelName);

        const channel = echoInstance.join(channelName);

        expect(channel.listen).toHaveBeenCalledWith(events[0], mockCallback);
        expect(channel.listen).toHaveBeenCalledWith(events[1], mockCallback);

        expect(() => unmount()).not.toThrow();

        expect(channel.stopListening).toHaveBeenCalledWith(
            events[0],
            mockCallback,
        );
        expect(channel.stopListening).toHaveBeenCalledWith(
            events[1],
            mockCallback,
        );
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        expect(echoInstance.join).toHaveBeenCalledWith(channelName);

        expect(() => unmount()).not.toThrow();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `presence-${channelName}`,
        );
    });

    it("won't subscribe multiple times to the same channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount: unmount1 } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        const { unmount: unmount2 } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        expect(echoInstance.join).toHaveBeenCalledTimes(1);
        expect(echoInstance.join).toHaveBeenCalledWith(channelName);

        expect(() => unmount1()).not.toThrow();
        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        expect(() => unmount2()).not.toThrow();
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `presence-${channelName}`,
        );
    });

    it("can leave a channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        result.current.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `presence-${channelName}`,
        );
    });

    it("can leave all channel variations", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        result.current.leave();

        expect(echoInstance.leave).toHaveBeenCalledWith(channelName);
    });

    it("events and listeners are optional", async () => {
        const channelName = "test-channel";

        const { result } = renderHook(() =>
            echoModule.useEchoPresence(channelName),
        );

        expect(result.current).toHaveProperty("channel");
        expect(result.current.channel).not.toBeNull();
    });
});

describe("useEchoNotification hook", async () => {
    let echoModule: typeof import("../src/hooks/use-echo");
    let configModule: typeof import("../src/config/index");
    let echoInstance: Echo<"null">;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });

        echoModule = await getEchoModule();
        configModule = await getConfigModule();

        configModule.configureEcho({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a private channel and listens for notifications", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";

        const { result } = renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");
        expect(typeof result.current.leave).toBe("function");
        expect(result.current).toHaveProperty("leave");
        expect(typeof result.current.leaveChannel).toBe("function");
        expect(result.current).toHaveProperty("listen");
        expect(typeof result.current.listen).toBe("function");
        expect(result.current).toHaveProperty("stopListening");
        expect(typeof result.current.stopListening).toBe("function");
    });

    it("sets up a notification listener on a channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";

        renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback),
        );

        expect(echoInstance.private).toHaveBeenCalledWith(channelName);

        const channel = echoInstance.private(channelName);
        expect(channel.notification).toHaveBeenCalled();
    });

    it("handles notification filtering by event type", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const eventType = "specific-type";

        renderHook(() =>
            echoModule.useEchoNotification(
                channelName,
                mockCallback,
                eventType,
            ),
        );

        const channel = echoInstance.private(channelName);
        expect(channel.notification).toHaveBeenCalled();

        const notificationCallback = vi.mocked(channel.notification).mock
            .calls[0][0];

        const matchingNotification = {
            type: eventType,
            data: { message: "test" },
        };
        const nonMatchingNotification = {
            type: "other-type",
            data: { message: "test" },
        };

        notificationCallback(matchingNotification);
        notificationCallback(nonMatchingNotification);

        expect(mockCallback).toHaveBeenCalledWith(matchingNotification);
        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).not.toHaveBeenCalledWith(nonMatchingNotification);
    });

    it("handles multiple notification event types", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["type1", "type2"];

        renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback, events),
        );

        const channel = echoInstance.private(channelName);
        expect(channel.notification).toHaveBeenCalled();

        const notificationCallback = vi.mocked(channel.notification).mock
            .calls[0][0];

        const notification1 = { type: events[0], data: {} };
        const notification2 = { type: events[1], data: {} };
        const notification3 = { type: "type3", data: {} };

        notificationCallback(notification1);
        notificationCallback(notification2);
        notificationCallback(notification3);

        expect(mockCallback).toHaveBeenCalledWith(notification1);
        expect(mockCallback).toHaveBeenCalledWith(notification2);
        expect(mockCallback).toHaveBeenCalledTimes(2);
        expect(mockCallback).not.toHaveBeenCalledWith(notification3);
    });

    it("handles dotted and slashed notification event types", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = [
            "App.Notifications.First",
            "App\\Notifications\\Second",
        ];

        renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback, events),
        );

        const channel = echoInstance.private(channelName);
        expect(channel.notification).toHaveBeenCalled();

        const notificationCallback = vi.mocked(channel.notification).mock
            .calls[0][0];

        const notification1 = { type: "App\\Notifications\\First", data: {} };
        const notification2 = { type: "App\\Notifications\\Second", data: {} };

        notificationCallback(notification1);
        notificationCallback(notification2);

        expect(mockCallback).toHaveBeenCalledWith(notification1);
        expect(mockCallback).toHaveBeenCalledWith(notification2);
        expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it("accepts all notifications when no event types specified", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";

        renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback),
        );

        const channel = echoInstance.private(channelName);
        expect(channel.notification).toHaveBeenCalled();

        const notificationCallback = vi.mocked(channel.notification).mock
            .calls[0][0];

        const notification1 = { type: "type1", data: {} };
        const notification2 = { type: "type2", data: {} };

        notificationCallback(notification1);
        notificationCallback(notification2);

        expect(mockCallback).toHaveBeenCalledWith(notification1);
        expect(mockCallback).toHaveBeenCalledWith(notification2);

        expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";

        const { unmount } = renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback),
        );

        const channel = echoInstance.private(channelName);

        expect(() => unmount()).not.toThrow();

        expect(channel.stopListeningForNotification).toHaveBeenCalled();
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `private-${channelName}`,
        );
    });

    it("won't subscribe multiple times to the same channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";

        const { unmount: unmount1 } = renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback),
        );

        const { unmount: unmount2 } = renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback),
        );

        expect(echoInstance.private).toHaveBeenCalledTimes(1);

        expect(() => unmount1()).not.toThrow();
        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        expect(() => unmount2()).not.toThrow();
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `private-${channelName}`,
        );
    });

    it("can leave a channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";

        const { result } = renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback),
        );

        result.current.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `private-${channelName}`,
        );
    });

    it("can leave all channel variations", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";

        const { result } = renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback),
        );

        result.current.leave();

        expect(echoInstance.leave).toHaveBeenCalledWith(channelName);
    });

    it("can manually start and stop listening", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";

        const { result } = renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback),
        );

        const channel = echoInstance.private(channelName);
        expect(channel.notification).toHaveBeenCalledTimes(1);

        result.current.stopListening();
        expect(channel.stopListeningForNotification).toHaveBeenCalled();

        result.current.listen();

        // notification should be re-registered after stop + listen
        expect(channel.notification).toHaveBeenCalledTimes(2);
    });

    it("stopListening prevents new notification listeners", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";

        const { result } = renderHook(() =>
            echoModule.useEchoNotification(channelName, mockCallback),
        );

        result.current.stopListening();

        expect(result.current.stopListening).toBeDefined();
        expect(typeof result.current.stopListening).toBe("function");
    });

    it("callback and events are optional", async () => {
        const channelName = "test-channel";

        const { result } = renderHook(() =>
            echoModule.useEchoNotification(channelName),
        );

        expect(result.current).toHaveProperty("channel");
        expect(result.current.channel).not.toBeNull();
    });

    it("maintains callback stability when dependencies don't change", async () => {
        const channelName = "test-channel";
        const dependency = "stable-value";
        const mockCallback = vi.fn();

        const { result, rerender } = renderHook(
            ({ deps, callback }) =>
                echoModule.useEchoNotification(channelName, callback, [], deps),
            {
                initialProps: {
                    deps: [dependency],
                    callback: mockCallback,
                },
            },
        );

        const firstResult = result.current;

        rerender({ deps: [dependency], callback: mockCallback });

        const secondResult = result.current;

        expect(firstResult.listen).toBe(secondResult.listen);
        expect(firstResult.stopListening).toBe(secondResult.stopListening);
        expect(firstResult.leaveChannel).toBe(secondResult.leaveChannel);
    });

    it("maintains return value stability when props don't change", async () => {
        const channelName = "test-channel";
        const mockCallback = vi.fn();
        const dependencies = ["dep1", "dep2"];

        const { result, rerender } = renderHook(() =>
            echoModule.useEchoNotification(
                channelName,
                mockCallback,
                [],
                dependencies,
            ),
        );

        const firstResult = result.current;

        rerender();

        const secondResult = result.current;

        expect(firstResult).toBe(secondResult);
        expect(firstResult.listen).toBe(secondResult.listen);
        expect(firstResult.stopListening).toBe(secondResult.stopListening);
    });

    it("handles array event dependencies with stable eventKey", async () => {
        const channelName = "test-channel";
        const events = ["type1", "type2"];
        const mockCallback = vi.fn();

        const { rerender } = renderHook(
            ({ eventArray }) =>
                echoModule.useEchoNotification(
                    channelName,
                    mockCallback,
                    eventArray,
                ),
            {
                initialProps: { eventArray: events },
            },
        );

        const channel = echoInstance.private(channelName);
        const initialNotificationCalls = vi.mocked(channel.notification).mock
            .calls.length;

        rerender({ eventArray: [...events] });

        const afterRerenderCalls = vi.mocked(channel.notification).mock.calls
            .length;

        expect(afterRerenderCalls).toBe(initialNotificationCalls);
    });
});

describe.skip("useConnectionStatus hook", async () => {
    let echoModule: typeof import("../src/hooks/use-echo");
    let configModule: typeof import("../src/config/index");

    beforeEach(async () => {
        vi.resetModules();

        echoModule = await getEchoModule();
        configModule = await getConfigModule();

        configModule.configureEcho({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns the connection status from echo instance", async () => {
        const { result } = renderHook(() => echoModule.useConnectionStatus());

        expect(result.current).toBe("connected");
    });
});
