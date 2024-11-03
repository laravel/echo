import { PresenceChannel } from './presence-channel';
import { PusherPrivateChannel } from './pusher-private-channel';

/**
 * This class represents a Pusher presence channel.
 */
export class PusherPresenceChannel extends PusherPrivateChannel implements PresenceChannel {
    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: Function): this {
        this.on('pusher:subscription_succeeded', (data) => {
            callback(Object.keys(data.members).map((k) => data.members[k]));
        });

        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: Function): this {
        this.on('pusher:member_added', (member) => {
            callback(member.info);
        });

        return this;
    }

    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(eventName: string, data: any): this {
        this.pusher.channels.channels[this.name].trigger(`client-${eventName}`, data);

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: Function): this {
        this.on('pusher:member_removed', (member) => {
            callback(member.info);
        });

        return this;
    }
}
