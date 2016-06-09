import {Channel} from './channel';

/**
 * This class represents a Pusher presence channel.
 */
export class PresenceChannel extends Channel {

    /**
     * Register a callback to be called anytime the member list changes.
     *
     * @param  {Function} callback
     * @return {PresenceChannel} this
     */
    here(callback) {
        this.bind(this.connector.updating, (data) => {
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
     * @return {PresenceChannel}
     */
    joining(callback) {
        this.bind(this.connector.adding, (member) => {
            member = member.info || member;

            callback(member, this.channel);
        });

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     * 
     * @param  {Function}  callback
     * @return {PresenceChannel}
     */
    leaving(callback) {
        this.bind(this.connector.removing, (member) => {
            member = member.info || member;

            callback(member, this.channel);
        });

        return this;
    }
}
