import type Echo from "laravel-echo";
import { type BroadcastDriver, type ConnectionStatus } from "laravel-echo";
import {
    type DependencyList,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { echo } from "../config";
import type {
    BroadcastNotification,
    Channel,
    ChannelReturnType,
    Connection,
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
    dependencies?: DependencyList,
    visibility?: TVisibility,
): {
    leaveChannel: (leaveAll?: boolean) => void;
    leave: () => void;
    stopListening: () => void;
    listen: () => void;
    channel: () => ChannelReturnType<TDriver, TVisibility> | null;
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
    channel: () => ChannelReturnType<TDriver, TVisibility> | null;
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
    dependencies?: DependencyList,
    visibility?: TVisibility,
): {
    leaveChannel: (leaveAll?: boolean) => void;
    leave: () => void;
    stopListening: () => void;
    listen: () => void;
    channel: () => ChannelReturnType<TDriver, TVisibility> | null;
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
            visibility,
        }),
        [channelName, visibility],
    );

    // callback and dependencies are parameters meant to be used directly
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
    const callbackFunc = useCallback(callback, dependencies);
    const listening = useRef(false);
    const held = useRef<HeldChannel<TDriver> | null>(null);
    const subscription = useRef<Connection<TDriver> | null>(null);

    const eventKey = Array.isArray(event) ? JSON.stringify(event) : event;
    // Using eventKey instead of event to stabilize array dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const events = useMemo(() => toArray(event), [eventKey]);

    const stopListening = useCallback(() => {
        if (!listening.current || !subscription.current) {
            return;
        }

        events.forEach((e) => {
            subscription.current!.stopListening(e, callbackFunc);
        });

        listening.current = false;
    }, [events, callbackFunc]);

    const listen = useCallback(() => {
        if (listening.current || !subscription.current) {
            return;
        }

        events.forEach((e) => {
            subscription.current!.listen(e, callbackFunc);
        });

        listening.current = true;
    }, [events, callbackFunc]);

    const tearDown = useCallback(
        (leaveAll: boolean = false) => {
            stopListening();
            releaseChannel(held.current, leaveAll);
            held.current = null;
        },
        [stopListening],
    );

    const leave = useCallback(() => {
        tearDown(true);
    }, [tearDown]);

    useEffect(() => {
        held.current = holdChannel<TDriver>(channel);
        subscription.current = held.current.connection;

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
                subscription.current as ChannelReturnType<
                    TDriver,
                    TVisibility
                > | null,
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

    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
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

        const ch = result.channel();

        if (!ch) {
            return;
        }

        ch.notification(cb);

        listening.current = true;
    }, [cb, result]);

    const stopListening = useCallback(() => {
        if (!listening.current) {
            return;
        }

        const ch = result.channel();

        if (!ch) {
            listening.current = false;
            return;
        }

        ch.stopListeningForNotification(cb);

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

export function useChannel<
    TDriver extends BroadcastDriver = BroadcastDriver,
    TVisibility extends Channel["visibility"] = "private",
>(channelName: string, visibility: TVisibility = "private" as TVisibility) {
    const channel: Channel = useMemo(
        () => ({
            name: channelName,
            visibility,
        }),
        [channelName, visibility],
    );

    const held = useRef<HeldChannel<TDriver> | null>(null);
    const subscription = useRef<Connection<TDriver> | null>(null);

    const tearDown = useCallback((leaveAll: boolean = false) => {
        releaseChannel(held.current, leaveAll);
        held.current = null;
    }, []);

    const leave = useCallback(() => {
        tearDown(true);
    }, [tearDown]);

    useEffect(() => {
        held.current = holdChannel<TDriver>(channel);
        subscription.current = held.current.connection;

        return () => tearDown();
    }, [tearDown, channel]);

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
             * Channel instance
             */
            channel: () =>
                subscription.current as ChannelReturnType<
                    TDriver,
                    TVisibility
                > | null,
        }),
        [leave, tearDown],
    );
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

const useConnectionChange = (
    callback: (status: ConnectionStatus) => void,
    invokeOnMount: boolean = true,
): void => {
    const callbackRef = useRef(callback);

    useLayoutEffect(() => {
        callbackRef.current = callback;
    });

    useEffect(() => {
        if (invokeOnMount) {
            callbackRef.current(echo().connectionStatus());
        }

        return echo().connector.onConnectionChange((status) =>
            callbackRef.current(status),
        );
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
};

export const useConnectionStatus = (): ConnectionStatus => {
    const [status, setStatus] = useState<ConnectionStatus>(() =>
        echo().connectionStatus(),
    );

    useConnectionChange((newStatus) => {
        setStatus(newStatus);
    });

    return status;
};

export const useSocketId = (): string | undefined => {
    const [socketId, setSocketId] = useState<string | undefined>(() =>
        echo().socketId(),
    );

    useConnectionChange(() => {
        setSocketId(echo().socketId());
    }, false);

    return socketId;
};
