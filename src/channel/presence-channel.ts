/**
 * This interface represents a presence channel.
 */
export interface PresenceChannel {
    /**
     * Register a callback to be called anytime the member list changes.
     *
     * @param  {Function} callback
     * @return {object} this
     */
    here(callback): PresenceChannel;

    /**
     * Listen for someone joining the channel.
     *
     * @param  {Function} callback
     * @return {PresenceChannel}
     */
    joining(callback): PresenceChannel;

    /**
     * Listen for someone leaving the channel.
     *
     * @param  {Function}  callback
     * @return {PresenceChannel}
     */
    leaving(callback): PresenceChannel;
}
