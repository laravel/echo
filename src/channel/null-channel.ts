import { Channel } from './channel';

/**
 * This class represents a null channel.
 */
export class NullChannel extends Channel {
    /**
     * Subscribe to a channel.
     */
    subscribe(): void {
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
    listen(_event: string, _callback: CallableFunction): this {
        return this;
    }

    /**
     * Listen for all events on the channel instance.
     */
    listenToAll(_callback: CallableFunction): this {
        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(_event: string, _callback?: CallableFunction): this {
        return this;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(_callback: CallableFunction): this {
        return this;
    }

    /**
     * Register a callback to be called anytime an error occurs.
     */
    error(_callback: CallableFunction): this {
        return this;
    }

    /**
     * Bind a channel to an event.
     */
    on(_event: string, _callback: CallableFunction): this {
        return this;
    }
}
