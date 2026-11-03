import type Echo from "laravel-echo";
import { type BroadcastDriver, type ConnectionStatus } from "laravel-echo";
import { onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import { echo } from "../config";
import type {
    BroadcastNotification,
    Channel,
    ChannelReturnType,
    Connection,
    Dependency,
    EventName,
    InferEventPayload,
    ModelEvents,
    ModelPayload,
} from "../types";
import { toArray } from "../util";

type HeldChannel<T extends BroadcastDriver> = {
    name: string;
    instance: Echo<T>;
    connection: Connection<T>;
    release: () => boolean;
};

const holdChannel = <T extends BroadcastDriver>(
    channel: Channel,
): HeldChannel<T> => {
    const instance = echo<T>();
    const { channel: connection, release } = instance.share(
        channel.name,
        channel.visibility,
    );

    return { name: channel.name, instance, connection, release };
};

const releaseChannel = <T extends BroadcastDriver>(
    held: HeldChannel<T> | null,
    leaveAll: boolean,
): void => {
    // Leaving the other variants only once nothing holds this one keeps every holder listening
    if (held?.release() && leaveAll) {
        held.instance.leaveUnheld(held.name);
    }
};

// Overload for automatic type inference from event name
export function useEcho<
    TEvent extends EventName = EventName,
    TDriver extends BroadcastDriver = BroadcastDriver,
    TVisibility extends Channel["visibility"] = "private",
>(
    channelName: string,
    event: TEvent,
    callback: (payload: InferEventPayload<TEvent>) => void,
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
    channelName: string,
    event: TEvent[],
    callback: (payload: InferEventPayload<TEvent>) => void,
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
    channelName: string,
    event?: string | string[],
    callback?: (payload: TPayload) => void,
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
    channelName: string,
    event: string | string[] = [],
    callback: (payload: TPayload) => void = () => {},
    dependencies: Dependency[] = [],
    visibility: TVisibility = "private" as TVisibility,
) {
    const eventCallback = ref(callback);
    const listening = ref(false);

    watch(
        () => callback,
        (newCallback) => {
            eventCallback.value = newCallback;
        },
    );

    const channel: Channel = {
        name: channelName,
        visibility,
    };

    let held: HeldChannel<TDriver> | null = holdChannel<TDriver>(channel);
    let subscription: Connection<TDriver> = held.connection;
    const events = Array.isArray(event) ? event : [event];

    const setupSubscription = () => {
        if (!held) {
            held = holdChannel<TDriver>(channel);
            subscription = held.connection;
        }

        listen();
    };

    const listen = () => {
        if (listening.value) {
            return;
        }

        events.forEach((e) => {
            subscription.listen(e, eventCallback.value);
        });

        listening.value = true;
    };

    const stopListening = () => {
        if (!listening.value) {
            return;
        }

        events.forEach((e) => {
            subscription.stopListening(e, eventCallback.value);
        });

        listening.value = false;
    };

    const tearDown = (leaveAll: boolean = false) => {
        stopListening();
        releaseChannel(held, leaveAll);
        held = null;
    };

    onMounted(() => {
        setupSubscription();
    });

    onUnmounted(() => {
        tearDown();
    });

    if (dependencies.length > 0) {
        watch(
            () => dependencies,
            () => {
                tearDown();
                setupSubscription();
            },
            { deep: true },
        );
    }

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
    channelName: string,
    callback: (payload: BroadcastNotification<TPayload>) => void = () => {},
    event: string | string[] = [],
    dependencies: Dependency[] = [],
) => {
    const result = useEcho<BroadcastNotification<TPayload>, TDriver, "private">(
        channelName,
        [],
        callback,
        dependencies,
        "private",
    );

    const events = toArray(event)
        .map((e) => {
            if (e.includes(".")) {
                return [e, e.replace(/\./g, "\\")];
            }

            return [e, e.replace(/\\/g, ".")];
        })
        .flat();

    const listening = ref(false);

    const cb = (notification: BroadcastNotification<TPayload>) => {
        if (!listening.value) {
            return;
        }

        if (events.length === 0 || events.includes(notification.type)) {
            callback(notification);
        }
    };

    const listen = () => {
        if (listening.value) {
            return;
        }

        result.channel().notification(cb);

        listening.value = true;
    };

    const stopListening = () => {
        if (!listening.value) {
            return;
        }

        result.channel().stopListeningForNotification(cb);
        listening.value = false;
    };

    onMounted(() => {
        listen();
    });

    onUnmounted(() => {
        stopListening();
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
    channelName: string,
    event: string | string[] = [],
    callback: (payload: TPayload) => void = () => {},
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
    channelName: string,
    event: string | string[] = [],
    callback: (payload: TPayload) => void = () => {},
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
>(channelName: string, visibility: TVisibility = "private" as TVisibility) {
    const channel: Channel = {
        name: channelName,
        visibility,
    };

    let held: HeldChannel<TDriver> | null = holdChannel<TDriver>(channel);
    const subscription: Connection<TDriver> = held.connection;

    const tearDown = (leaveAll: boolean = false) => {
        releaseChannel(held, leaveAll);
        held = null;
    };

    onUnmounted(() => {
        tearDown();
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
    channelName: string,
) => {
    return useChannel<TDriver, "presence">(channelName, "presence");
};

export const usePublicChannel = <
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: string,
) => {
    return useChannel<TDriver, "public">(channelName, "public");
};

export const useEchoModel = <
    TPayload,
    TModel extends string,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    model: TModel,
    identifier: string | number,
    event: ModelEvents<TModel> | ModelEvents<TModel>[] = [],
    callback: (payload: ModelPayload<TPayload>) => void = () => {},
    dependencies: Dependency[] = [],
) => {
    return useEcho<ModelPayload<TPayload>, TDriver, "private">(
        `${model}.${identifier}`,
        toArray(event).map((e) => (e.startsWith(".") ? e : `.${e}`)),
        callback,
        dependencies,
        "private",
    );
};

const useConnectionChange = (
    callback: (status: ConnectionStatus) => void,
    invokeOnMount: boolean = true,
): void => {
    const echoInstance = echo();

    let unsubscribe: (() => void) | undefined;

    onMounted(() => {
        if (invokeOnMount) {
            callback(echoInstance.connectionStatus());
        }

        unsubscribe = echoInstance.connector.onConnectionChange(callback);
    });

    onUnmounted(() => {
        unsubscribe?.();
    });
};

export const useConnectionStatus = (): Ref<ConnectionStatus> => {
    const echoInstance = echo();
    const status = ref<ConnectionStatus>(echoInstance.connectionStatus());

    useConnectionChange((newStatus) => {
        status.value = newStatus;
    });

    return status;
};

export const useSocketId = (): Ref<string | undefined> => {
    const echoInstance = echo();
    const socketId = ref<string | undefined>(echoInstance.socketId());

    useConnectionChange(() => {
        socketId.value = echoInstance.socketId();
    }, false);

    return socketId;
};
