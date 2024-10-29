import { Channel } from './channel';

/**
 * This interface represents a presence channel.
 */
export interface PresenceChannel<T> extends Channel<T> {
    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: Function): T;

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: Function): T;

    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(eventName: string, data: any): T;

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: Function): T;
}
