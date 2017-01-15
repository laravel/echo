import { PusherChannel } from './pusher-channel';

/**
 * This class represents a Pusher private channel.
 */
export class PusherPrivateChannel extends PusherChannel {
    /**
     * Trigger client event on the channel.
     *
     * @param  {Function}  callback
     * @return {PusherPrivateChannel}
     */
    whisper(eventName, data): PusherPrivateChannel {
        this.pusher.channels.channels[this.name].trigger(`client-${eventName}`, data);

        return this;
    }
}
