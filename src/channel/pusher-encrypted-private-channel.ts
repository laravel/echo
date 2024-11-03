import { PusherChannel } from './pusher-channel';

/**
 * This class represents a Pusher private channel.
 */
export class PusherEncryptedPrivateChannel extends PusherChannel {
    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(eventName: string, data: any): this {
        this.pusher.channels.channels[this.name].trigger(`client-${eventName}`, data);

        return this;
    }
}
