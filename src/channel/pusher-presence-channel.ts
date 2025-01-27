import type { PresenceChannel } from './presence-channel';
import { PusherPrivateChannel } from './pusher-private-channel';
import type { BroadcastDriver } from '../echo';

/**
 * This class represents a Pusher presence channel.
 */
export class PusherPresenceChannel<TBroadcastDriver extends BroadcastDriver>
    extends PusherPrivateChannel<TBroadcastDriver>
    implements PresenceChannel
{
    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: CallableFunction): this {
        this.on('pusher:subscription_succeeded', (data: Record<any, any>) => {
            callback(Object.keys(data.members).map((k) => data.members[k]));
        });

        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: CallableFunction): this {
        this.on('pusher:member_added', (member: Record<any, any>) => {
            callback(member.info);
        });

        return this;
    }

    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(eventName: string, data: Record<any, any>): this {
        this.pusher.channels.channels[this.name].trigger(`client-${eventName}`, data);

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: CallableFunction): this {
        this.on('pusher:member_removed', (member: Record<any, any>) => {
            callback(member.info);
        });

        return this;
    }
}
