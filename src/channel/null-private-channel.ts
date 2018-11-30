import { NullChannel } from './null-channel';

/**
 * This class represents a null private channel.
 */
export class NullPrivateChannel extends NullChannel {
    /**
     * Trigger client event on the channel.
     */
    whisper(eventName: string, data: any): NullPrivateChannel {
        return this;
    }
}
