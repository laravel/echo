import { PieSocketChannel } from './piesocket-channel';
import { PresenceChannel } from './presence-channel';

/**
 * This class represents a PieSocket presence channel.
 */
export class PieSocketPresenceChannel extends PieSocketChannel implements PresenceChannel {

    /**
     * Members present in the channel
     */
    members: any;

    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: Function): PieSocketPresenceChannel {
        this.listen('system:member_list', (data) => {
            callback(
                Object.keys(data.members).map((k) => {
                    try {
                        return JSON.parse(data.members[k]);
                    } catch(e) {
                        //Handle json exception i.e. strings
                        return data.members[k];
                    }
                })
            );
        });

        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: Function): PieSocketPresenceChannel {
        this.listen('system:member_joined', (data) => {
            try {
                callback(JSON.parse(data.member));
            } catch(e) {
                //Handle json exception i.e. strings
                callback(data.member);
            }
        });

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: Function): PieSocketPresenceChannel {
        this.listen('system:member_left', (data) => {
            try {
                callback(JSON.parse(data.member));
            } catch(e) {
                //Handle json exception i.e. strings
                callback(data.member);
            }
        });

        return this;
    }

    /**
     * Trigger client event on the channel.
     */
    whisper(eventName: string, data: any): PieSocketPresenceChannel {
        this.publish(`client-${eventName}`, data);
        return this;
    }
}
