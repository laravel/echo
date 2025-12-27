import { type BroadcastDriver, type Broadcaster } from "laravel-echo";

export type Connection<T extends BroadcastDriver> =
    | Broadcaster[T]["public"]
    | Broadcaster[T]["private"]
    | Broadcaster[T]["presence"];

export type ChannelData<T extends BroadcastDriver> = {
    count: number;
    connection: Connection<T>;
};

export type Channel = {
    name: string;
    id: string;
    visibility: "private" | "public" | "presence";
};

export type BroadcastNotification<TPayload> = TPayload & {
    id: string;
    type: string;
};

export type ChannelReturnType<
    T extends BroadcastDriver,
    V extends Channel["visibility"],
> = V extends "presence"
    ? Broadcaster[T]["presence"]
    : V extends "private"
      ? Broadcaster[T]["private"]
      : Broadcaster[T]["public"];

export type ConfigDefaults<O extends BroadcastDriver> = Record<
    O,
    Broadcaster[O]["options"]
>;

export type ModelPayload<T> = {
    model: T;
    connection: string | null;
    queue: string | null;
    afterCommit: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ModelName<T extends string> = T extends `${infer _}.${infer U}`
    ? ModelName<U>
    : T;

type ModelEvent =
    | "Retrieved"
    | "Creating"
    | "Created"
    | "Updating"
    | "Updated"
    | "Saving"
    | "Saved"
    | "Deleting"
    | "Deleted"
    | "Trashed"
    | "ForceDeleting"
    | "ForceDeleted"
    | "Restoring"
    | "Restored"
    | "Replicating";

export type ModelEvents<T extends string> =
    | `.${ModelName<T>}${ModelEvent}`
    | `${ModelName<T>}${ModelEvent}`;

/**
 * Global Events interface for type inference
 * Users can extend this in their .d.ts files to define event payload types
 *
 * @example
 * // In user's types/echo.d.ts file (simplest approach):
 * interface Events {
 *   OrganizationUpdated: {
 *     id: number;
 *     name: string;
 *     updated_at: string;
 *   };
 *   UserCreated: {
 *     id: number;
 *     email: string;
 *     name: string;
 *   };
 * }
 *
 * @example
 * // Alternative: Module augmentation
 * declare module '@laravel/echo-react' {
 *   interface Events {
 *     OrganizationUpdated: {
 *       id: number;
 *       name: string;
 *       updated_at: string;
 *     };
 *   }
 * }
 */
declare global {
    interface Events {
        // This interface is meant to be extended by users in their .d.ts files
    }
}

/**
 * Type alias for event names - helps with autocomplete suggestions
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type EventName = keyof Events & string;

/**
 * Type utility to infer payload type from event name
 */
export type InferEventPayload<TEvent extends string> =
    TEvent extends keyof Events ? Events[TEvent] : unknown;
