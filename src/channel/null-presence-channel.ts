import { NullChannel } from './null-channel';
import { PresenceChannel } from './presence-channel';

/**
 * This class represents a null presence channel.
 */
export class NullPresenceChannel extends NullChannel implements PresenceChannel {
    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: Function): NullPresenceChannel {
        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: Function): NullPresenceChannel {
        return this;
    }

    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(eventName: string, data: any): NullPresenceChannel {
        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: Function): NullPresenceChannel {
        return this;
    }
}
