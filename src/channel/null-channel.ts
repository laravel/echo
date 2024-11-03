import { Channel } from './channel';

/**
 * This class represents a null channel.
 */
export class NullChannel extends Channel {
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
    listen(event: string, callback: Function): this {
        return this;
    }

    /**
     * Listen for all events on the channel instance.
     */
    listenToAll(callback: Function): this {
        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: Function): this {
        return this;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: Function): this {
        return this;
    }

    /**
     * Register a callback to be called anytime an error occurs.
     */
    error(callback: Function): this {
        return this;
    }

    /**
     * Bind a channel to an event.
     */
    on(event: string, callback: Function): this {
        return this;
    }
}
