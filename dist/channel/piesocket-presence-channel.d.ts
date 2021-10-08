import { PieSocketChannel } from './piesocket-channel';
import { PresenceChannel } from './presence-channel';
/**
 * This class represents a PieSocket presence channel.
 */
export declare class PieSocketPresenceChannel extends PieSocketChannel implements PresenceChannel {
    /**
     * Members present in the channel
     */
    members: any;
    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: Function): PieSocketPresenceChannel;
    /**
     * Listen for someone joining the channel.
     */
    joining(callback: Function): PieSocketPresenceChannel;
    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: Function): PieSocketPresenceChannel;
    /**
     * Trigger client event on the channel.
     */
    whisper(eventName: string, data: any): PieSocketPresenceChannel;
}
