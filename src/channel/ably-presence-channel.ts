import { AblyChannel } from './ably-channel';
import { AblyAuth } from './ably/auth';
import { PresenceChannel } from './presence-channel';

/**
 * This class represents an Ably presence channel.
 */
export class AblyPresenceChannel extends AblyChannel implements PresenceChannel {

  constructor(ably: any, name: string, options: any, auth: AblyAuth) {
    super(ably, name, options);
    this.channel.on("failed", auth.onChannelFailed(this));
  }

  unsubscribe(): void {
    this.channel.presence.unsubscribe();
    super.unsubscribe();
  }
  
  /**
   * Register a callback to be called anytime the member list changes.
   */
  here(callback: Function): AblyPresenceChannel {
    this.channel.presence.get((err, members) => {
      if (err) {
        callback(null, err);
        return;
      }

      callback(members, null);
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

  /**
   * Enter presence
   * @param data - Data to be published while entering the channel
   * @param callback - success/error callback (err) => {}
   * @returns AblyPresenceChannel
   */
  enter(data: any, callback: Function): AblyPresenceChannel {
    this.channel.presence.enter(data, callback as any);
    
    return this;
  }

  /**
   * Leave presence
   * @param data - Data to be published while leaving the channel
   * @param callback - success/error callback (err) => {}
   * @returns AblyPresenceChannel
   */
  leave(data: any, callback: Function): AblyPresenceChannel {
    this.channel.presence.leave(data, callback as any);

    return this;
  }

  /**
 * Update presence
 * @param data - Update presence with data
 * @param callback - success/error callback (err) => {}
 * @returns AblyPresenceChannel
 */
  update(data: any, callback: Function): AblyPresenceChannel {
    this.channel.presence.update(data, callback as any);

    return this;
  }

  /**
 * Trigger client event on the channel.
 */
  whisper(eventName: string, data: any): AblyPresenceChannel {
    this.channel.publish(`client-${eventName}`, data);

    return this;
  }

}
