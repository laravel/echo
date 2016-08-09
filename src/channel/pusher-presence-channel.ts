import {PusherChannel} from './pusher-channel';
import {PresenceChannel} from './presence-channel';

/**
 * This class represents a Pusher presence channel.
 */
export class PusherPresenceChannel extends PusherChannel implements PresenceChannel {

    /**
     * Register a callback to be called anytime the member list changes.
     *
     * @param  {Function} callback
     * @return {object} this
     */
    here(callback): PusherPresenceChannel {
        this.bind('pusher:subscription_succeeded', (data) => {
            let members = data;

            if (data.members) {
                members = Object.keys(data.members).map(k => data.members[k]);
            }

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
        this.bind('pusher:member_added', (member) => {
            callback(member.info || member, this.channel);
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
        this.bind('pusher:member_removed', (member) => {
            callback(member.info || member, this.channel);
        });

        return this;
    }
}
