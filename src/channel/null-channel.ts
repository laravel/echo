import { EventFormatter } from './../util';
import { Channel } from './channel';

/**
 * This class represents a null channel.
 */
export class NullChannel extends Channel {
    /**
     * Subscribe to a channel.
     *
     * @param  {string} channel
     * @return {object}
     */
    subscribe(): any {
        //
    }

    /**
     * Unsubscribe from a channel.
     *
     * @return {void}
     */
    unsubscribe(): void {
        //
    }

    /**
     * Listen for an event on the channel instance.
     *
     * @param  {string} event
     * @param  {Function}   callback
     * @return {NullChannel}
     */
    listen(event: string, callback: Function): NullChannel {
        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     *
     * @param  {string} event
     * @return {NullChannel}
     */
    stopListening(event: string): NullChannel {
        return this;
    }

    /**
     * Bind a channel to an event.
     *
     * @param  {string}   event
     * @param  {Function} callback
     * @return {NullChannel}
     */
    on(event: string, callback: Function): NullChannel {
        return this;
    }
}
