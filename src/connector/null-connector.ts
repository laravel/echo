import { Connector} from './connector';
import {
    NullChannel, NullPrivateChannel, NullPresenceChannel, PresenceChannel
} from './../channel';

/**
 * This class creates a null connector.
 */
export class NullConnector extends Connector {
    /**
     * All of the subscribed channel names.
     *
     * @type {array}
     */
    channels: any = {};

    /**
     * Create a fresh connection.
     *
     * @return void
     */
    connect(): void {
        //
    }

    /**
     * Listen for an event on a channel instance.
     *
     * @param  {string} name
     * @param  {event} string
     * @param  {Function} callback
     * @return {NullChannel}
     */
    listen(name: string, event: string, callback: Function): NullChannel {
        return new NullChannel;
    }

    /**
     * Get a channel instance by name.
     *
     * @param  {string} name
     * @return {NullChannel}
     */
    channel(name: string): NullChannel {
        return new NullChannel;
    }

    /**
     * Get a private channel instance by name.
     *
     * @param  {string} name
     * @return {NullPrivateChannel}
     */
    privateChannel(name: string): NullPrivateChannel {
        return new NullPrivateChannel;
    }

    /**
     * Get a presence channel instance by name.
     *
     * @param  {string} name
     * @return {PresenceChannel}
     */
    presenceChannel(name: string): PresenceChannel {
        return new NullPresenceChannel;
    }

    /**
     * Leave the given channel.
     *
     * @param  {string} channel
     */
    leave(name: string) {
        //
    }

    /**
     * Get the socket ID for the connection.
     *
     * @return {string}
     */
    socketId(): string {
        return 'fake-socket-id';
    }

    /**
     * Disconnect the connection.
     *
     * @return void
     */
    disconnect(): void {
        //
    }
}
