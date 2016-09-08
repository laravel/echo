import { PresenceChannel, SocketIoChannel } from './';

/**
 * This class represents a Socket.io presence channel.
 */
export class SocketIoPresenceChannel extends SocketIoChannel implements PresenceChannel {

    /**
     * Register a callback to be called anytime the member list changes.
     *
     * @param  {Function} callback
     * @return {object} this
     */
    here(callback): SocketIoPresenceChannel {
        this.on('presence:subscribed', (members) => {
            callback(members.map(m => m.user_info), this.subscription);
        });

        return this;
    }

    /**
     * Listen for someone joining the channel.
     *
     * @param  {Function} callback
     * @return {PusherPresenceChannel}
     */
    joining(callback): SocketIoPresenceChannel {
        this.on('presence:joining', (member) => {
            callback(member.user_info, this.subscription);
        });

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     *
     * @param  {Function}  callback
     * @return {PusherPresenceChannel}
     */
    leaving(callback): SocketIoPresenceChannel {
        this.on('presence:leaving', (member) => {
            callback(member.user_info, this.subscription);
        });

        return this;
    }
}
