import type Echo from "laravel-echo";
import { type BroadcastDriver, type ConnectionStatus } from "laravel-echo";
import { echo } from "../config";
import type {
    BroadcastNotification,
    CallbackInput,
    Channel,
    ChannelData,
    ChannelReturnType,
    Connection,
    Dependency,
    EventName,
    InferEventPayload,
    ModelEvents,
    ModelPayload,
    ReactiveInput,
} from "../types";
import { toArray } from "../util";

const channels: Record<string, ChannelData<BroadcastDriver>> = {};
let activeEchoInstance: Echo<BroadcastDriver> | null = null;

const clearChannelCache = (): void => {
    Object.keys(channels).forEach((channelId) => {
        delete channels[channelId];
    });
};

const resolveChannelSubscription = <T extends BroadcastDriver>(
    channel: Channel,
): Connection<T> => {
    const instance = echo<T>();

    if (
        activeEchoInstance !== null &&
        activeEchoInstance !== (instance as Echo<BroadcastDriver>)
    ) {
        clearChannelCache();
    }

    activeEchoInstance = instance as Echo<BroadcastDriver>;

    if (channels[channel.id]) {
        channels[channel.id].count += 1;

        return channels[channel.id].connection;
    }

    const channelSubscription = subscribeToChannel<T>(instance, channel);

    channels[channel.id] = {
        count: 1,
        connection: channelSubscription,
    };

    return channelSubscription;
};

const subscribeToChannel = <T extends BroadcastDriver>(
    instance: Echo<T>,
    channel: Channel,
): Connection<T> => {
    if (channel.visibility === "presence") {
        return instance.join(channel.name);
    }

    if (channel.visibility === "private") {
        return instance.private(channel.name);
    }

    return instance.channel(channel.name);
};

const leaveChannel = (channel: Channel, leaveAll: boolean = false): void => {
    if (!channels[channel.id]) {
        return;
    }

    channels[channel.id].count -= 1;

    if (channels[channel.id].count > 0) {
        return;
    }

    delete channels[channel.id];

    if (leaveAll) {
        echo().leave(channel.name);
    } else {
        echo().leaveChannel(channel.id);
    }
};

const trackDependencies = (dependencies: Dependency[]): void => {
    dependencies.forEach((dependency) => {
        if (typeof dependency === "function") {
            const getter = dependency as () => unknown;

            void getter();

            return;
        }

        void dependency;
    });
};

const resolveInput = <T>(input: ReactiveInput<T>): T => {
    if (typeof input === "function") {
        return (input as () => T)();
    }

    return input;
};

const resolveCallback = <TPayload>(
    callback: CallbackInput<TPayload>,
): ((payload: TPayload) => void) => {
    if (typeof callback === "function") {
        return callback;
    }

    return callback.current;
};

const resolveChannel = <TVisibility extends Channel["visibility"]>(
    channelName: ReactiveInput<string>,
    visibility: TVisibility,
): Channel => {
    const resolvedChannelName = resolveInput(channelName);

    return {
        name: resolvedChannelName,
        id: ["private", "presence"].includes(visibility)
            ? `${visibility}-${resolvedChannelName}`
            : resolvedChannelName,
        visibility,
    };
};

// Overload for automatic type inference from event name
export function useEcho<
    TEvent extends EventName = EventName,
    TDriver extends BroadcastDriver = BroadcastDriver,
    TVisibility extends Channel["visibility"] = "private",
>(
    channelName: ReactiveInput<string>,
    event: ReactiveInput<TEvent>,
    callback: CallbackInput<InferEventPayload<TEvent>>,
    dependencies?: Dependency[],
    visibility?: TVisibility,
): {
    leaveChannel: (leaveAll?: boolean) => void;
    leave: () => void;
    stopListening: () => void;
    listen: () => void;
    channel: () => ChannelReturnType<TDriver, TVisibility>;
};

// Overload for multiple events with automatic type inference
export function useEcho<
    TEvent extends EventName = EventName,
    TDriver extends BroadcastDriver = BroadcastDriver,
    TVisibility extends Channel["visibility"] = "private",
>(
    channelName: ReactiveInput<string>,
    event: ReactiveInput<TEvent[]>,
    callback: CallbackInput<InferEventPayload<TEvent>>,
    dependencies?: Dependency[],
    visibility?: TVisibility,
): {
    leaveChannel: (leaveAll?: boolean) => void;
    leave: () => void;
    stopListening: () => void;
    listen: () => void;
    channel: () => ChannelReturnType<TDriver, TVisibility>;
};

// Overload for explicit payload type (backward compatibility)
export function useEcho<
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
    TVisibility extends Channel["visibility"] = "private",
>(
    channelName: ReactiveInput<string>,
    event: ReactiveInput<string | string[]>,
    callback: CallbackInput<TPayload>,
    dependencies?: Dependency[],
    visibility?: TVisibility,
): {
    leaveChannel: (leaveAll?: boolean) => void;
    leave: () => void;
    stopListening: () => void;
    listen: () => void;
    channel: () => ChannelReturnType<TDriver, TVisibility>;
};

// Implementation
export function useEcho<
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
    TVisibility extends Channel["visibility"] = "private",
>(
    channelName: ReactiveInput<string>,
    event: ReactiveInput<string | string[]> = [],
    callback: CallbackInput<TPayload> = () => {},
    dependencies: Dependency[] = [],
    visibility: TVisibility = "private" as TVisibility,
) {
    let listening = false;
    let initialized = false;
    let channel = resolveChannel(channelName, visibility);
    let events = toArray(resolveInput(event));
    let subscription: Connection<TDriver> =
        resolveChannelSubscription<TDriver>(channel);

    const eventCallback = (payload: TPayload) => {
        resolveCallback(callback)(payload);
    };

    const listen = () => {
        if (listening) {
            return;
        }

        events.forEach((e) => {
            subscription.listen(e, eventCallback);
        });

        listening = true;
    };

    const stopListening = () => {
        if (!listening) {
            return;
        }

        events.forEach((e) => {
            subscription.stopListening(e, eventCallback);
        });

        listening = false;
    };

    const tearDown = (leaveAll: boolean = false) => {
        stopListening();
        leaveChannel(channel, leaveAll);
    };

    $effect(() => {
        trackDependencies(dependencies);
        channel = resolveChannel(channelName, visibility);
        events = toArray(resolveInput(event));

        if (initialized) {
            subscription = resolveChannelSubscription<TDriver>(channel);
        }

        initialized = true;
        listen();

        return () => tearDown();
    });

    return {
        /**
         * Leave the channel
         */
        leaveChannel: tearDown,
        /**
         * Leave the channel and also its associated private and presence channels
         */
        leave: () => tearDown(true),
        /**
         * Stop listening for event(s) without leaving the channel
         */
        stopListening,
        /**
         * Listen for event(s)
         */
        listen,
        /**
         * Channel instance
         */
        channel: () => subscription as ChannelReturnType<TDriver, TVisibility>,
    };
}

export const useEchoNotification = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: ReactiveInput<string>,
    callback: CallbackInput<BroadcastNotification<TPayload>> = () => {},
    event: ReactiveInput<string | string[]> = [],
    dependencies: Dependency[] = [],
) => {
    const result = useEcho<BroadcastNotification<TPayload>, TDriver, "private">(
        channelName,
        [],
        callback,
        dependencies,
        "private",
    );

    let listening = false;
    let events = toArray(resolveInput(event))
        .map((e) => {
            if (e.includes(".")) {
                return [e, e.replace(/\./g, "\\")];
            }

            return [e, e.replace(/\\/g, ".")];
        })
        .flat();

    const cb = (notification: BroadcastNotification<TPayload>) => {
        if (!listening) {
            return;
        }

        if (events.length === 0 || events.includes(notification.type)) {
            resolveCallback(callback)(notification);
        }
    };

    const listen = () => {
        if (listening) {
            return;
        }

        result.channel().notification(cb);

        listening = true;
    };

    const stopListening = () => {
        if (!listening) {
            return;
        }

        result.channel().stopListeningForNotification(cb);
        listening = false;
    };

    $effect(() => {
        trackDependencies(dependencies);
        events = toArray(resolveInput(event))
            .map((e) => {
                if (e.includes(".")) {
                    return [e, e.replace(/\./g, "\\")];
                }

                return [e, e.replace(/\\/g, ".")];
            })
            .flat();

        listen();

        return () => stopListening();
    });

    return {
        ...result,
        /**
         * Stop listening for notification events
         */
        stopListening,
        /**
         * Listen for notification events
         */
        listen,
    };
};

export const useEchoPresence = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: ReactiveInput<string>,
    event: ReactiveInput<string | string[]> = [],
    callback: CallbackInput<TPayload> = () => {},
    dependencies: Dependency[] = [],
) => {
    return useEcho<TPayload, TDriver, "presence">(
        channelName,
        event,
        callback,
        dependencies,
        "presence",
    );
};

export const useEchoPublic = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: ReactiveInput<string>,
    event: ReactiveInput<string | string[]> = [],
    callback: CallbackInput<TPayload> = () => {},
    dependencies: Dependency[] = [],
) => {
    return useEcho<TPayload, TDriver, "public">(
        channelName,
        event,
        callback,
        dependencies,
        "public",
    );
};

export function useChannel<
    TDriver extends BroadcastDriver = BroadcastDriver,
    TVisibility extends Channel["visibility"] = "private",
>(
    channelName: ReactiveInput<string>,
    visibility: TVisibility = "private" as TVisibility,
) {
    let channel = resolveChannel(channelName, visibility);
    let subscription: Connection<TDriver> =
        resolveChannelSubscription<TDriver>(channel);

    const tearDown = (leaveAll: boolean = false) => {
        leaveChannel(channel, leaveAll);
    };

    $effect(() => {
        channel = resolveChannel(channelName, visibility);
        subscription = resolveChannelSubscription<TDriver>(channel);

        return () => tearDown();
    });

    return {
        /**
         * Leave the channel
         */
        leaveChannel: tearDown,
        /**
         * Leave the channel and also its associated private and presence channels
         */
        leave: () => tearDown(true),
        /**
         * Channel instance
         */
        channel: () => subscription as ChannelReturnType<TDriver, TVisibility>,
    };
}

export const usePresenceChannel = <
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: ReactiveInput<string>,
) => {
    return useChannel<TDriver, "presence">(channelName, "presence");
};

export const usePublicChannel = <
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: ReactiveInput<string>,
) => {
    return useChannel<TDriver, "public">(channelName, "public");
};

export const useEchoModel = <
    TPayload,
    TModel extends string,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    model: ReactiveInput<TModel>,
    identifier: ReactiveInput<string | number>,
    event: ReactiveInput<ModelEvents<TModel> | ModelEvents<TModel>[]> = [],
    callback: CallbackInput<ModelPayload<TPayload>> = () => {},
    dependencies: Dependency[] = [],
) => {
    return useEcho<ModelPayload<TPayload>, TDriver, "private">(
        () => `${resolveInput(model)}.${resolveInput(identifier)}`,
        () =>
            toArray(resolveInput(event)).map((e) =>
                e.startsWith(".") ? e : `.${e}`,
            ),
        callback,
        dependencies,
        "private",
    );
};

const useConnectionChange = (
    callback: (status: ConnectionStatus) => void,
    invokeOnMount: boolean = true,
): void => {
    $effect(() => {
        if (invokeOnMount) {
            callback(echo().connectionStatus());
        }

        const unsubscribe = echo().connector.onConnectionChange(callback);

        return () => unsubscribe();
    });
};

export const useConnectionStatus = (): (() => ConnectionStatus) => {
    let status = $state<ConnectionStatus>(echo().connectionStatus());

    useConnectionChange((newStatus) => {
        status = newStatus;
    });

    return () => status;
};

export const useSocketId = (): (() => string | undefined) => {
    let socketId = $state<string | undefined>(echo().socketId());

    useConnectionChange(() => {
        socketId = echo().socketId();
    }, false);

    return () => socketId;
};
