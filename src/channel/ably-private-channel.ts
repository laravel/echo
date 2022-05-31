import { AblyChannel } from './ably-channel';

export class AblyPrivateChannel extends AblyChannel {
    /**
     * Trigger client event on the channel.
     */
    whisper(eventName: string, data: any): AblyPrivateChannel {
        this.channel.publish(`client-${eventName}`, data);

        return this;
    }
}