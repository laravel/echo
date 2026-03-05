import { type BroadcastDriver, type ConnectionStatus } from "laravel-echo";
import {
    type DependencyList,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
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

const leaveChannel = (channel: Channel, leaveAll: boolean): void => {
    if (!channels[channel.id]) {
        return;
    }

    channels[channel.id].count -= 1;

    if (channels[channel.id].count > 0) {
        return;
    }

    if (leaveAll) {
        echo().leave(channel.name);
    } else {
        echo().leaveChannel(channel.id);
    }

    delete channels[channel.id];
};

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

// Overload for automatic type inference from event name
export function useEcho<
    TEvent extends EventName = EventName,
    TDriver extends BroadcastDriver = BroadcastDriver,
    TVisibility extends Channel["visibility"] = "private",
>(
    channelName: string,
    event: TEvent,
    callback: (payload: InferEventPayload<TEvent>) => void,
    dependencies?: DependencyList,
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
    dependencies?: DependencyList,
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
    dependencies?: DependencyList,
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
    dependencies: DependencyList = [],
    visibility: TVisibility = "private" as TVisibility,
) {
    const channel: Channel = useMemo(
        () => ({
            name: channelName,
            id: ["private", "presence"].includes(visibility)
                ? `${visibility}-${channelName}`
                : channelName,
            visibility,
        }),
        [channelName, visibility],
    );

    // callback and dependencies are parameters meant to be used directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const callbackFunc = useCallback(callback, dependencies);
    const listening = useRef(false);
    const initialized = useRef(false);
    const subscription = useRef<Connection<TDriver>>(
        resolveChannelSubscription<TDriver>(channel),
    );

    const eventKey = Array.isArray(event) ? JSON.stringify(event) : event;
    // Using eventKey instead of event to stabilize array dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const events = useMemo(() => toArray(event), [eventKey]);

    const stopListening = useCallback(() => {
        if (!listening.current) {
            return;
        }

        events.forEach((e) => {
            subscription.current.stopListening(e, callbackFunc);
        });

        listening.current = false;
    }, [events, callbackFunc]);

    const listen = useCallback(() => {
        if (listening.current) {
            return;
        }

        events.forEach((e) => {
            subscription.current.listen(e, callbackFunc);
        });

        listening.current = true;
    }, [events, callbackFunc]);

    const tearDown = useCallback(
        (leaveAll: boolean = false) => {
            stopListening();

            leaveChannel(channel, leaveAll);
        },
        [stopListening, channel],
    );

    const leave = useCallback(() => {
        tearDown(true);
    }, [tearDown]);

    useEffect(() => {
        if (initialized.current) {
            subscription.current = resolveChannelSubscription<TDriver>(channel);
        }

        initialized.current = true;

        listen();

        return tearDown;
    }, [listen, tearDown, channel]);

    return useMemo(
        () => ({
            /**
             * Leave the channel
             */
            leaveChannel: tearDown,
            /**
             * Leave the channel and also its associated private and presence channels
             */
            leave,
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
            channel: () =>
                subscription.current as ChannelReturnType<TDriver, TVisibility>,
        }),
        [leave, listen, stopListening, tearDown],
    );
}

export const useEchoNotification = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: string,
    callback: (payload: BroadcastNotification<TPayload>) => void = () => {},
    event: string | string[] = [],
    dependencies: DependencyList = [],
) => {
    const result = useEcho<BroadcastNotification<TPayload>, TDriver, "private">(
        channelName,
        [],
        callback,
        dependencies,
        "private",
    );

    const eventKey = Array.isArray(event) ? JSON.stringify(event) : event;
    const events = useMemo(() => {
        return toArray(event)
            .map((e) => {
                if (e.includes(".")) {
                    return [e, e.replace(/\./g, "\\")];
                }

                return [e, e.replace(/\\/g, ".")];
            })
            .flat();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventKey]);

    const listening = useRef(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedCallback = useCallback(callback, dependencies);

    const cb = useCallback(
        (notification: BroadcastNotification<TPayload>) => {
            if (!listening.current) {
                return;
            }

            if (events.length === 0 || events.includes(notification.type)) {
                memoizedCallback(notification);
            }
        },
        [memoizedCallback, events],
    );

    const listen = useCallback(() => {
        if (listening.current) {
            return;
        }

        result.channel().notification(cb);

        listening.current = true;
    }, [cb, result]);

    const stopListening = useCallback(() => {
        if (!listening.current) {
            return;
        }

        result.channel().stopListeningForNotification(cb);

        listening.current = false;
    }, [cb, result]);

    useEffect(() => {
        listen();

        return () => stopListening();
    }, [listen, stopListening]);

    return useMemo(
        () => ({
            ...result,
            /**
             * Stop listening for notification events
             */
            stopListening,
            /**
             * Listen for notification events
             */
            listen,
        }),
        [result, stopListening, listen],
    );
};

export const useEchoPresence = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: string,
    event: string | string[] = [],
    callback: (payload: TPayload) => void = () => {},
    dependencies: DependencyList = [],
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
    dependencies: DependencyList = [],
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
    dependencies: DependencyList = [],
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
 * Hook to get the current WebSocket connection status
 *
 * @returns ConnectionStatus - The current connection status
 */
export const useConnectionStatus = (): ConnectionStatus => {
    const [status, setStatus] = useState<ConnectionStatus>(() =>
        echo().connectionStatus(),
    );

    useEffect(() => {
        return echo().connector.onConnectionChange(
            (newStatus: ConnectionStatus) => {
                setStatus(newStatus);
            },
        );
    }, []);

    return status;
};
