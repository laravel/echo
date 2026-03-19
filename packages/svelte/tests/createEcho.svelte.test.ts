import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { echoInstances } = vi.hoisted(() => ({
    echoInstances: [] as any[],
}));

const createMockPrivateChannel = () => ({
    listen: vi.fn(),
    stopListening: vi.fn(),
    notification: vi.fn(),
    stopListeningForNotification: vi.fn(),
});

const createMockPublicChannel = () => ({
    listen: vi.fn(),
    stopListening: vi.fn(),
});

const createMockPresenceChannel = () => ({
    listen: vi.fn(),
    stopListening: vi.fn(),
    here: vi.fn(),
    joining: vi.fn(),
    leaving: vi.fn(),
    whisper: vi.fn(),
});

vi.mock("laravel-echo", () => {
    const Echo = vi.fn((config: unknown) => {
        const privateChannel = createMockPrivateChannel();
        const publicChannel = createMockPublicChannel();
        const presenceChannel = createMockPresenceChannel();
        const unsubscribe = vi.fn();
        let onConnectionChange: ((status: string) => void) | undefined;

        const instance = {
            options: config,
            private: vi.fn(() => privateChannel),
            channel: vi.fn(() => publicChannel),
            join: vi.fn(() => presenceChannel),
            leave: vi.fn(),
            leaveChannel: vi.fn(),
            leaveAllChannels: vi.fn(),
            connectionStatus: vi.fn(() => "connected"),
            connector: {
                onConnectionChange: vi.fn((callback: (status: string) => void) => {
                    onConnectionChange = callback;

                    return unsubscribe;
                }),
            },
            __privateChannel: privateChannel,
            __publicChannel: publicChannel,
            __presenceChannel: presenceChannel,
            __emitStatus: (status: string) => onConnectionChange?.(status),
            __unsubscribe: unsubscribe,
        };

        echoInstances.push(instance);

        return instance;
    });

    return { default: Echo };
});

const getEchoModule = async () => import("../src/runes/createEcho");
const getConfigModule = async () => import("../src/config/index");

const setupConfiguredEcho = async () => {
    const echoModule = await getEchoModule();
    const configModule = await getConfigModule();

    configModule.configureEcho({
        broadcaster: "null",
    });

    return {
        echoModule,
        configModule,
        instance: configModule.echo() as any,
    };
};

const mountRune = async <T>(factory: (module: Awaited<ReturnType<typeof getEchoModule>>) => T) => {
    const context = await setupConfiguredEcho();
    let value!: T;

    const cleanup = $effect.root(() => {
        value = factory(context.echoModule);
    });

    await tick();

    return {
        ...context,
        cleanup,
        value,
    };
};

describe("createEcho (Svelte runes)", () => {
    beforeEach(() => {
        vi.resetModules();
        echoInstances.length = 0;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("throws if echo is used before configureEcho", async () => {
        const { createEcho } = await getEchoModule();

        expect(() =>
            $effect.root(() => {
                createEcho("orders.1", "OrderUpdated", vi.fn());
            }),
        ).toThrow("Echo has not been configured");
    });

    it("subscribes to a private channel and exposes channel controls", async () => {
        const callback = vi.fn();
        const { instance, value, cleanup } = await mountRune((echoModule) =>
            echoModule.createEcho("orders.1", "OrderUpdated", callback),
        );

        expect(value).toHaveProperty("leaveChannel");
        expect(value).toHaveProperty("leave");
        expect(value).toHaveProperty("listen");
        expect(value).toHaveProperty("stopListening");
        expect(instance.private).toHaveBeenCalledWith("orders.1");
        expect(instance.__privateChannel.listen).toHaveBeenCalledWith(
            "OrderUpdated",
            expect.any(Function),
        );

        cleanup();
    });

    it("handles multiple private events and stops listening on teardown", async () => {
        const callback = vi.fn();
        const { instance, cleanup } = await mountRune((echoModule) =>
            echoModule.createEcho(
                "orders.2",
                ["OrderUpdated", "OrderShipped"],
                callback,
            ),
        );

        expect(instance.__privateChannel.listen).toHaveBeenCalledWith(
            "OrderUpdated",
            expect.any(Function),
        );
        expect(instance.__privateChannel.listen).toHaveBeenCalledWith(
            "OrderShipped",
            expect.any(Function),
        );

        cleanup();
        await tick();

        expect(instance.__privateChannel.stopListening).toHaveBeenCalledTimes(2);
        expect(instance.leaveChannel).toHaveBeenCalledWith("private-orders.2");
    });

    it("subscribes once for identical private channels and leaves after last teardown", async () => {
        const { echoModule, instance } = await setupConfiguredEcho();

        const cleanupA = $effect.root(() => {
            echoModule.createEcho("orders.3", "OrderUpdated", vi.fn());
        });

        const cleanupB = $effect.root(() => {
            echoModule.createEcho("orders.3", "OrderUpdated", vi.fn());
        });

        await tick();

        expect(instance.private).toHaveBeenCalledTimes(1);
        expect(instance.__privateChannel.listen).toHaveBeenCalledTimes(2);

        cleanupA();
        await tick();

        expect(instance.leaveChannel).not.toHaveBeenCalled();

        cleanupB();
        await tick();

        expect(instance.leaveChannel).toHaveBeenCalledWith("private-orders.3");
    });

    it("can leave a private channel", async () => {
        const { instance, value, cleanup } = await mountRune((echoModule) =>
            echoModule.createEcho("orders.4", "OrderUpdated", vi.fn()),
        );

        value.leaveChannel();
        expect(instance.leaveChannel).toHaveBeenCalledWith("private-orders.4");

        cleanup();
    });

    it("can leave all private channel variations", async () => {
        const { instance, value, cleanup } = await mountRune((echoModule) =>
            echoModule.createEcho("orders.4", "OrderUpdated", vi.fn()),
        );

        value.leave();
        expect(instance.leave).toHaveBeenCalledWith("orders.4");

        cleanup();
    });

    it("supports manual listen and stopListening controls", async () => {
        const { instance, value, cleanup } = await mountRune((echoModule) =>
            echoModule.createEcho("orders.5", "OrderUpdated", vi.fn()),
        );

        value.stopListening();
        expect(instance.__privateChannel.stopListening).toHaveBeenCalledTimes(1);

        value.listen();
        expect(instance.__privateChannel.listen).toHaveBeenCalledTimes(2);

        cleanup();
    });

    it("guards against duplicate listen and stopListening calls", async () => {
        const { instance, value, cleanup } = await mountRune((echoModule) =>
            echoModule.createEcho("orders.6", "OrderUpdated", vi.fn()),
        );

        value.listen();
        expect(instance.__privateChannel.listen).toHaveBeenCalledTimes(1);

        value.stopListening();
        value.stopListening();
        expect(instance.__privateChannel.stopListening).toHaveBeenCalledTimes(1);

        cleanup();
    });

    it("allows events and callbacks to be omitted", async () => {
        const { instance, value, cleanup } = await mountRune((echoModule) =>
            echoModule.createEcho("orders.7"),
        );

        expect(value.channel()).toBe(instance.__privateChannel);
        expect(instance.__privateChannel.listen).not.toHaveBeenCalled();

        cleanup();
    });

    it("uses dependency getters reactively without resubscribing", async () => {
        const { echoModule, instance } = await setupConfiguredEcho();

        let setVersion: (value: number) => void = () => {};
        let dependencyRuns = 0;

        const cleanup = $effect.root(() => {
            let version = $state(0);
            setVersion = (value: number) => {
                version = value;
            };

            echoModule.createEcho("orders.8", "OrderUpdated", vi.fn(), [
                () => {
                    dependencyRuns += 1;

                    return version;
                },
            ]);
        });

        await tick();

        expect(dependencyRuns).toBe(1);
        expect(instance.__privateChannel.listen).toHaveBeenCalledTimes(1);

        setVersion(1);
        await tick();

        expect(dependencyRuns).toBe(2);
        expect(instance.__privateChannel.listen).toHaveBeenCalledTimes(1);

        cleanup();
    });

    it("clears stale channel cache when configureEcho swaps instances", async () => {
        const { echoModule, configModule, instance: firstInstance } =
            await setupConfiguredEcho();

        const firstCleanup = $effect.root(() => {
            echoModule.createEcho("orders.9", "OrderUpdated", vi.fn());
        });

        await tick();

        configModule.configureEcho({
            broadcaster: "null",
        });

        expect(firstInstance.leaveAllChannels).toHaveBeenCalledTimes(1);

        const secondInstance = configModule.echo() as any;
        const secondCleanup = $effect.root(() => {
            echoModule.createEcho("orders.9", "OrderUpdated", vi.fn());
        });

        await tick();

        expect(secondInstance).not.toBe(firstInstance);
        expect(secondInstance.private).toHaveBeenCalledTimes(1);

        secondCleanup();
        firstCleanup();
    });
});

describe("createEchoPublic", () => {
    beforeEach(() => {
        vi.resetModules();
        echoInstances.length = 0;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a public channel and leaves it on teardown", async () => {
        const { instance, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoPublic("posts", "PostPublished", vi.fn()),
        );

        expect(instance.channel).toHaveBeenCalledWith("posts");
        expect(instance.__publicChannel.listen).toHaveBeenCalledWith(
            "PostPublished",
            expect.any(Function),
        );

        cleanup();
        await tick();

        expect(instance.leaveChannel).toHaveBeenCalledWith("posts");
    });

    it("allows events and callbacks to be omitted", async () => {
        const { instance, value, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoPublic("posts"),
        );

        expect(value.channel()).toBe(instance.__publicChannel);
        expect(instance.__publicChannel.listen).not.toHaveBeenCalled();

        cleanup();
    });
});

describe("createEchoPresence", () => {
    beforeEach(() => {
        vi.resetModules();
        echoInstances.length = 0;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a presence channel and leaves it on teardown", async () => {
        const { instance, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoPresence("chat.1", "MessageSent", vi.fn()),
        );

        expect(instance.join).toHaveBeenCalledWith("chat.1");
        expect(instance.__presenceChannel.listen).toHaveBeenCalledWith(
            "MessageSent",
            expect.any(Function),
        );

        cleanup();
        await tick();

        expect(instance.leaveChannel).toHaveBeenCalledWith("presence-chat.1");
    });

    it("allows events and callbacks to be omitted", async () => {
        const { instance, value, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoPresence("chat.1"),
        );

        expect(value.channel()).toBe(instance.__presenceChannel);
        expect(instance.__presenceChannel.listen).not.toHaveBeenCalled();

        cleanup();
    });
});

describe("createEchoNotification", () => {
    beforeEach(() => {
        vi.resetModules();
        echoInstances.length = 0;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a private channel and registers a notification listener", async () => {
        const { instance, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoNotification("users.1", vi.fn()),
        );

        expect(instance.private).toHaveBeenCalledWith("users.1");
        expect(instance.__privateChannel.notification).toHaveBeenCalledTimes(1);

        cleanup();
    });

    it("filters notifications by event type", async () => {
        const callback = vi.fn();
        const { instance, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoNotification(
                "users.2",
                callback,
                "App.Notifications.Welcome",
            ),
        );

        const listener = instance.__privateChannel.notification.mock.calls[0][0];
        listener({ type: "App\\Notifications\\Welcome", data: {} });
        listener({ type: "App\\Notifications\\Ignored", data: {} });

        expect(callback).toHaveBeenCalledTimes(1);

        cleanup();
    });

    it("handles multiple notification event types", async () => {
        const callback = vi.fn();
        const { instance, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoNotification("users.3", callback, [
                "App.Notifications.First",
                "App.Notifications.Second",
            ]),
        );

        const listener = instance.__privateChannel.notification.mock.calls[0][0];
        listener({ type: "App\\Notifications\\First", data: {} });
        listener({ type: "App\\Notifications\\Second", data: {} });
        listener({ type: "App\\Notifications\\Third", data: {} });

        expect(callback).toHaveBeenCalledTimes(2);

        cleanup();
    });

    it("accepts all notifications when no event types are specified", async () => {
        const callback = vi.fn();
        const { instance, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoNotification("users.4", callback),
        );

        const listener = instance.__privateChannel.notification.mock.calls[0][0];
        listener({ type: "Type.One", data: {} });
        listener({ type: "Type.Two", data: {} });

        expect(callback).toHaveBeenCalledTimes(2);

        cleanup();
    });

    it("allows notification listeners to stop and resume", async () => {
        const callback = vi.fn();
        const { instance, value, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoNotification(
                "users.5",
                callback,
                "App.Notifications.Welcome",
            ),
        );

        const firstListener =
            instance.__privateChannel.notification.mock.calls[0][0];

        firstListener({ type: "App\\Notifications\\Welcome" });
        expect(callback).toHaveBeenCalledTimes(1);

        value.stopListening();
        firstListener({ type: "App\\Notifications\\Welcome" });
        expect(callback).toHaveBeenCalledTimes(1);
        expect(
            instance.__privateChannel.stopListeningForNotification,
        ).toHaveBeenCalledTimes(1);

        value.listen();
        expect(instance.__privateChannel.notification).toHaveBeenCalledTimes(2);

        const secondListener =
            instance.__privateChannel.notification.mock.calls[1][0];
        secondListener({ type: "App\\Notifications\\Welcome" });
        expect(callback).toHaveBeenCalledTimes(2);

        cleanup();
    });
});

describe("createEchoModel", () => {
    beforeEach(() => {
        vi.resetModules();
        echoInstances.length = 0;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a model channel and prefixes model events", async () => {
        const { instance, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoModel(
                "App.Models.User",
                1,
                "UserCreated",
                vi.fn(),
            ),
        );

        expect(instance.private).toHaveBeenCalledWith("App.Models.User.1");
        expect(instance.__privateChannel.listen).toHaveBeenCalledWith(
            ".UserCreated",
            expect.any(Function),
        );

        cleanup();
    });

    it("handles multiple model events", async () => {
        const { instance, cleanup } = await mountRune((echoModule) =>
            echoModule.createEchoModel(
                "App.Models.User",
                1,
                ["UserCreated", "UserUpdated"],
                vi.fn(),
            ),
        );

        expect(instance.__privateChannel.listen).toHaveBeenCalledWith(
            ".UserCreated",
            expect.any(Function),
        );
        expect(instance.__privateChannel.listen).toHaveBeenCalledWith(
            ".UserUpdated",
            expect.any(Function),
        );

        cleanup();
    });
});

describe("createConnectionStatus", () => {
    beforeEach(() => {
        vi.resetModules();
        echoInstances.length = 0;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("tracks connection status changes and unsubscribes on teardown", async () => {
        const { instance, value, cleanup } = await mountRune((echoModule) =>
            echoModule.createConnectionStatus(),
        );

        expect(value()).toBe("connected");

        instance.__emitStatus("reconnecting");
        await tick();
        expect(value()).toBe("reconnecting");

        cleanup();
        expect(instance.__unsubscribe).toHaveBeenCalledTimes(1);
    });
});
