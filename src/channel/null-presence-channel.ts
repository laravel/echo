import { NullChannel } from './null-channel';
import { PresenceChannel } from './presence-channel';

/**
 * This class represents a null presence channel.
 */
export class NullPresenceChannel extends NullChannel implements PresenceChannel {
    /**
     * Register a callback to be called anytime the member list changes.
     *
     * @param  {Function} callback
     * @return {object} this
     */
    here(callback): NullPresenceChannel {
        return this;
    }

    /**
     * Listen for someone joining the channel.
     *
     * @param  {Function} callback
     * @return {NullPresenceChannel}
     */
    joining(callback): NullPresenceChannel {
        return this;
    }

    /**
     * Listen for someone leaving the channel.
     *
     * @param  {Function}  callback
     * @return {NullPresenceChannel}
     */
    leaving(callback): NullPresenceChannel {
        return this;
    }

    /**
     * Trigger client event on the channel.
     *
     * @param  {Function}  callback
     * @return {NullPresenceChannel}
     */
    whisper(eventName, data): NullPresenceChannel {
        return this;
    }
}
