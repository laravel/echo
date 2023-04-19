import { NullChannel } from './null-channel';

/**
 * This class represents a null private channel.
 */
export class NullPrivateChannel extends NullChannel {
    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(eventName: string, data: any): NullPrivateChannel {
        return this;
    }
}
