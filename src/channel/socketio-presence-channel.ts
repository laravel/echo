import {SocketIoChannel} from './socketio-channel';
import {PresenceChannel} from './presence-channel';

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
    here(callback): PusherPresenceChannel {
        this.on('presence:subscribed', (members) => {
            callback(members, this.channel);
        });

        return this;
    }

    /**
     * Listen for someone joining the channel.
     *
     * @param  {Function} callback
     * @return {PusherPresenceChannel}
     */
    joining(callback): PusherPresenceChannel {
        this.on('presence:joining', (member) => {
            callback(member, this.channel);
        });

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     *
     * @param  {Function}  callback
     * @return {PusherPresenceChannel}
     */
    leaving(callback): PusherPresenceChannel {
        this.on('presence:leaving', (member) => {
            callback(member, this.channel);
        });

        return this;
    }
}
