import { type BroadcastDriver, type ConnectionStatus } from "laravel-echo";
import { onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import { echo } from "../config";
import type {
    BroadcastNotification,
    Channel,
    ChannelData,
    ChannelReturnType,
    Connection,
    EventName,
    InferEventPayload,
    ModelEvents,
    ModelPayload,
} from "../types";
import { toArray } from "../util";

const channels: Record<string, ChannelData<BroadcastDriver>> = {};

const resolveChannelSubscription = <T extends BroadcastDriver>(
    channel: Channel,
): Connection<T> => {
    if (channels[channel.id]) {
        channels[channel.id].count += 1;

        return channels[channel.id].connection;
    }

    const channelSubscription = subscribeToChannel<T>(channel);

    channels[channel.id] = {
        count: 1,
        connection: channelSubscription,
    };

    return channelSubscription;
};

const subscribeToChannel = <T extends BroadcastDriver>(
    channel: Channel,
): Connection<T> => {
    const instance = echo<T>();

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

// Overload for automatic type inference from event name
export function useEcho<
    TEvent extends EventName = EventName,
    TDriver extends BroadcastDriver = BroadcastDriver,
    TVisibility extends Channel["visibility"] = "private",
>(
    channelName: string,
    event: TEvent,
    callback: (payload: InferEventPayload<TEvent>) => void,
    dependencies?: any[],
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
    dependencies?: any[],
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
    event: string | string[],
    callback: (payload: TPayload) => void,
    dependencies?: any[],
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
    dependencies: any[] = [],
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
        id: ["private", "presence"].includes(visibility)
            ? `${visibility}-${channelName}`
            : channelName,
        visibility,
    };

    const subscription: Connection<TDriver> =
        resolveChannelSubscription<TDriver>(channel);
    const events = Array.isArray(event) ? event : [event];

    const setupSubscription = () => {
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
        leaveChannel(channel, leaveAll);
    };

    onMounted(() => {
        setupSubscription();
    });

    onUnmounted(() => {
        tearDown();
    });

    if (dependencies.length > 0) {
        watch(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
    dependencies: any[] = [],
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
    dependencies: any[] = [],
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
    dependencies: any[] = [],
) => {
    return useEcho<TPayload, TDriver, "public">(
        channelName,
        event,
        callback,
        dependencies,
        "public",
    );
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
    dependencies: any[] = [],
) => {
    return useEcho<ModelPayload<TPayload>, TDriver, "private">(
        `${model}.${identifier}`,
        toArray(event).map((e) => (e.startsWith(".") ? e : `.${e}`)),
        callback,
        dependencies,
        "private",
    );
};

/**
 * Composable to get the current WebSocket connection status
 *
 * @returns Ref<ConnectionStatus> - A reactive ref containing the current connection status
 */
export const useConnectionStatus = (): Ref<ConnectionStatus> => {
    const status = ref<ConnectionStatus>(echo().connectionStatus());

    let unsubscribe: (() => void) | undefined;

    onMounted(() => {
        unsubscribe = echo().connector.onConnectionChange((newStatus) => {
            status.value = newStatus;
        });
    });

    onUnmounted(() => {
        unsubscribe?.();
    });

    return status;
};
