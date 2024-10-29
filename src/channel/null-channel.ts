import { Channel } from './channel';

/**
 * This class represents a null channel.
 */
export class NullChannel<T> extends Channel<T> {
    /**
     * Subscribe to a channel.
     */
    subscribe(): any {
        //
    }

    /**
     * Unsubscribe from a channel.
     */
    unsubscribe(): void {
        //
    }

    /**
     * Listen for an event on the channel instance.
     */
    listen(event: string, callback: Function): T {
        return this as unknown as T;
    }

    /**
     * Listen for all events on the channel instance.
     */
    listenToAll(callback: Function): T {
        return this as unknown as T;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: Function): T {
        return this as unknown as T;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: Function): T {
        return this as unknown as T;
    }

    /**
     * Register a callback to be called anytime an error occurs.
     */
    error(callback: Function): T {
        return this as unknown as T;
    }

    /**
     * Bind a channel to an event.
     */
    on(event: string, callback: Function): T {
        return this as unknown as T;
    }
}
