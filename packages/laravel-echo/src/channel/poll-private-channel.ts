import { PollChannel } from "./poll-channel";

/**
 * This class represents a poll private channel.
 */
export class PollPrivateChannel extends PollChannel {
    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(_eventName: string, _data: Record<any, any>): this {
        return this;
    }
}
