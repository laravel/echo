import { type BroadcastDriver, type ConnectionStatus } from "laravel-echo";
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
export function createEcho<
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
export function createEcho<
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
export function createEcho<
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
export function createEcho<
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
    let listening = false;
    let eventCallback = callback;
    const events = Array.isArray(event) ? event : [event];

    const channel: Channel = {
        name: channelName,
        id: ["private", "presence"].includes(visibility)
            ? `${visibility}-${channelName}`
            : channelName,
        visibility,
    };

    const subscription: Connection<TDriver> =
        resolveChannelSubscription<TDriver>(channel);

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
        // Track external reactive dependencies
        const currentCallback = callback;
        if (dependencies.length > 0) {
            dependencies.forEach((dep) => dep);
        }

        // Update callback and listeners if callback changed
        const previousCallback = eventCallback;
        eventCallback = currentCallback;

        if (listening && previousCallback !== currentCallback) {
            events.forEach((e) => {
                subscription.stopListening(e, previousCallback);
                subscription.listen(e, eventCallback);
            });
        } else if (!listening) {
            listen();
        }

        return () => {
            tearDown();
        };
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

export const createEchoNotification = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: string,
    callback: (payload: BroadcastNotification<TPayload>) => void = () => {},
    event: string | string[] = [],
    dependencies: any[] = [],
) => {
    const result = createEcho<BroadcastNotification<TPayload>, TDriver, "private">(
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

    let listening = false;
    let initialized = false;

    const cb = (notification: BroadcastNotification<TPayload>) => {
        if (!listening) {
            return;
        }

        if (events.length === 0 || events.includes(notification.type)) {
            callback(notification);
        }
    };

    const listen = () => {
        if (listening) {
            return;
        }

        if (!initialized) {
            result.channel().notification(cb);
        }

        listening = true;
        initialized = true;
    };

    const stopListening = () => {
        if (!listening) {
            return;
        }

        result.channel().stopListeningForNotification(cb);
        listening = false;
    };

    $effect(() => {
        // Track external reactive dependencies
        callback;
        if (dependencies.length > 0) {
            dependencies.forEach((dep) => dep);
        }

        listen();

        return () => {
            stopListening();
        };
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

export const createEchoPresence = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: string,
    event: string | string[] = [],
    callback: (payload: TPayload) => void = () => {},
    dependencies: any[] = [],
) => {
    return createEcho<TPayload, TDriver, "presence">(
        channelName,
        event,
        callback,
        dependencies,
        "presence",
    );
};

export const createEchoPublic = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: string,
    event: string | string[] = [],
    callback: (payload: TPayload) => void = () => {},
    dependencies: any[] = [],
) => {
    return createEcho<TPayload, TDriver, "public">(
        channelName,
        event,
        callback,
        dependencies,
        "public",
    );
};

export const createEchoModel = <
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
    return createEcho<ModelPayload<TPayload>, TDriver, "private">(
        `${model}.${identifier}`,
        toArray(event).map((e) => (e.startsWith(".") ? e : `.${e}`)),
        callback,
        dependencies,
        "private",
    );
};

/**
 * Rune to get the current WebSocket connection status
 *
 * @returns A getter function that returns the current connection status
 */
export const createConnectionStatus = (): (() => ConnectionStatus) => {
    let status = $state<ConnectionStatus>(echo().connectionStatus());

    $effect(() => {
        const unsubscribe = echo().connector.onConnectionChange((newStatus) => {
            status = newStatus;
        });

        status = echo().connectionStatus();

        const timeoutId = setTimeout(() => {
            status = echo().connectionStatus();
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            unsubscribe();
        };
    });

    return () => status;
};
