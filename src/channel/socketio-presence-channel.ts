import { PresenceChannel, SocketIoPrivateChannel } from './';

/**
 * This class represents a Socket.io presence channel.
 */
export class SocketIoPresenceChannel extends SocketIoPrivateChannel implements PresenceChannel {
    /**
     * Register a callback to be called anytime the member list changes.
     *
     * @param  {Function} callback
     * @return {object} SocketIoPresenceChannel
     */
    here(callback: Function): SocketIoPresenceChannel {
        this.on('presence:subscribed', (members) => {
            callback(members.map(m => m.user_info));
        });

        return this;
    }

    /**
     * Listen for someone joining the channel.
     *
     * @param  {Function} callback
     * @return {SocketIoPresenceChannel}
     */
    joining(callback: Function): SocketIoPresenceChannel {
        this.on('presence:joining', (member) => callback(member.user_info));

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     *
     * @param  {Function}  callback
     * @return {SocketIoPresenceChannel}
     */
    leaving(callback: Function): SocketIoPresenceChannel {
        this.on('presence:leaving', (member) => callback(member.user_info));

        return this;
    }
}
