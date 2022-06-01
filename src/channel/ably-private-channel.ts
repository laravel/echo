import { AblyChannel } from './ably-channel';
import { AblyAuth } from './ably/auth';

export class AblyPrivateChannel extends AblyChannel {

    constructor(ably: any, name: string, options: any, auth: AblyAuth) {
        super(ably, name, options);
        this.channel.on("failed", auth.onChannelFailed(this));
    }
    /**
     * Trigger client event on the channel.
     */
    whisper(eventName: string, data: any): AblyPrivateChannel {
        this.channel.publish(`client-${eventName}`, data);

        return this;
    }
}