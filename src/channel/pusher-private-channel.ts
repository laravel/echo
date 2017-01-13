import { PusherChannel } from './pusher-channel';

/**
 * This class represents a Pusher private channel.
 */
export class PusherPrivateChannel extends PusherChannel {
    /**
     * Trigger client event on the channel.
     *
     * @return {PusherPrivateChannel}
     * @param {string} eventName
     * @param {any} data
     */
    whisper(eventName: string, data: any): PusherPrivateChannel {
        this.pusher.channels.channels[this.name].trigger(`client-${eventName}`, data);

        return this;
    }
}
