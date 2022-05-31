import { AblyChannel } from './ably-channel';
import { PresenceChannel } from './presence-channel';

/**
 * This class represents an Ably presence channel.
 */
export class AblyPresenceChannel extends AblyChannel implements PresenceChannel {
    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: Function): AblyPresenceChannel {
        this.channel.presence.get((err, members) => {
          if(err) {
            callback(err);
            return;
          }

          callback(members);

        })

        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: Function): AblyPresenceChannel {
        this.channel.presence.subscribe('enter', (member) => {
            callback(member);
        });

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: Function): AblyPresenceChannel {
        this.channel.presence.subscribe('leave', (member) => {
            callback(member);
        });

        return this;
    }

    // TODO - Need to check for whisper implementation for presence channels
    /**
     * Trigger client event on the channel.
     */
    whisper(eventName: string, data: any): AblyPresenceChannel {
        switch (eventName) {
          case 'enter':
            this.channel.presence.enter(data);
            break;
          case 'leave':
            this.channel.presence.leave(data);
            break;
          case 'update':
            this.channel.presence.update(data);
            break;
        }

        return this;
    }
}
