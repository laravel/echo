import { Connector} from './connector';
import {
    PusherChannel, PusherPrivateChannel, PusherPresenceChannel, PresenceChannel
} from './../channel';

/**
 * This class creates a connector to Pusher.
 */
export class PusherConnector extends Connector {
    /**
     * The Pusher instance.
     *
     * @type {object}
     */
    pusher: any;

    /**
     * All of the subscribed channel names.
     *
     * @type {array}
     */
    channels: any = {};

    /**
     * Create a fresh Pusher connection.
     *
     * @return void
     */
    connect(): void {
        this.pusher = new Pusher(this.options.key, this.options);
    }

    /**
     * Listen for an event on a channel instance.
     *
     * @param  {string} name
     * @param  {event} string
     * @param  {Function} callback
     * @return {PusherChannel}
     */
    listen(name: string, event: string, callback: Function): PusherChannel {
        return this.channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     *
     * @param  {string} name
     * @return {PusherChannel}
     */
    channel(name: string): PusherChannel {
        if (!this.channels[name]) {
            this.channels[name] = new PusherChannel(
                this.pusher,
                name,
                this.options
            );
        }

        return this.channels[name];
    }

    /**
     * Get a private channel instance by name.
     *
     * @param  {string} name
     * @return {PusherPrivateChannel}
     */
    privateChannel(name: string): PusherChannel {
        if (!this.channels['private-' + name]) {
            this.channels['private-' + name] = new PusherPrivateChannel(
                this.pusher,
                'private-' + name,
                this.options
            );
        }

        return this.channels['private-' + name];
    }

    /**
     * Get a presence channel instance by name.
     *
     * @param  {string} name
     * @return {PresenceChannel}
     */
    presenceChannel(name: string): PresenceChannel {
        if (!this.channels['presence-' + name]) {
            this.channels['presence-' + name] = new PusherPresenceChannel(
                this.pusher,
                'presence-' + name,
                this.options
            );
        }

        return this.channels['presence-' + name];
    }

    /**
     * Leave the given channel.
     *
     * @param  {string} channel
     */
    leave(name: string) {
        let channels = [name, 'private-' + name, 'presence-' + name];

        channels.forEach((name: string, index: number) => {
            if (this.channels[name]) {
                this.channels[name].unsubscribe();

                delete this.channels[name];
            }
        });
    }

    /**
     * Get the socket ID for the connection.
     *
     * @return {string}
     */
    socketId(): string {
        return this.pusher.connection.socket_id;
    }

    /**
     * Disconnect Pusher connection.
     *
     * @return void
     */
    disconnect(): void {
        this.pusher.disconnect();
    }
}
