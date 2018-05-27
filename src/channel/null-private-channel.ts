import { NullChannel } from './null-channel';

/**
 * This class represents a null private channel.
 */
export class NullPrivateChannel extends NullChannel {
    /**
     * Trigger client event on the channel.
     *
     * @param  {Function}  callback
     * @return {NullPrivateChannel}
     */
    whisper(eventName, data): NullPrivateChannel {
        return this;
    }
}
