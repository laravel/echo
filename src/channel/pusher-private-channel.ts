import { PusherChannel } from './pusher-channel';
import type { BroadcastDriver } from '../echo';

/**
 * This class represents a Pusher private channel.
 */
export class PusherPrivateChannel<TBroadcastDriver extends BroadcastDriver> extends PusherChannel<TBroadcastDriver> {
    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(eventName: string, data: Record<any, any>): this {
        this.pusher.channels.channels[this.name].trigger(`client-${eventName}`, data);

        return this;
    }
}
