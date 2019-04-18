import { PresenceChannel } from './presence-channel';
import { SocketIoPrivateChannel } from './socketio-private-channel';

/**
 * This class represents a Socket.io presence channel.
 */
export class SocketIoPresenceChannel extends SocketIoPrivateChannel implements PresenceChannel {
    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: Function): SocketIoPresenceChannel {
        this.on('presence:subscribed', (members: any[]) => {
            callback(members.map(m => m.user_info));
        });

        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: Function): SocketIoPresenceChannel {
        this.on('presence:joining', member => callback(member.user_info));

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: Function): SocketIoPresenceChannel {
        this.on('presence:leaving', member => callback(member.user_info));

        return this;
    }
}
