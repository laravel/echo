import { Connector} from './connector';
import {
    PusherChannel, PusherPresenceChannel, PresenceChannel
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
    channels: any[] = [];

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
     */
    listen(channel: string, event: string, callback: Function) {
        return this.channel(channel).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     *
     * @param  {string}  channel
     * @return {PusherChannel}
     */
    channel(channel: string): PusherChannel {
        return new PusherChannel(this.createChannel(channel), this.options);
    }

    /**
     * Get a private channel instance by name.
     *
     * @param  {string}  channel
     * @return {PusherChannel}
     */
    privateChannel(channel: string): PusherChannel {
        return new PusherChannel(this.createChannel('private-' + channel), this.options);
    }

    /**
     * Get a presence channel instance by name.
     *
     * @param  {string} channel
     * @return {PresenceChannel}
     */
    presenceChannel(channel: string): PresenceChannel {
        return new PusherPresenceChannel(this.createChannel('presence-' + channel), this.options);
    }

    /**
     * Create and subscribe to a fresh channel instance.
     *
     * @param  {string} channel
     * @return {object}
     */
    createChannel(channel: string): any {
        if (!this.channels[channel]) {
            this.channels[channel] = this.subscribe(channel);
        }

        return this.channels[channel];
    }

    /**
     * Leave the given channel.
     *
     * @param  {string} channel
     */
    leave(channel: string) {
        let channels = [channel, 'private-' + channel, 'presence-' + channel];

        channels.forEach((channelName: string, index: number) => {
            if (this.channels[channelName]) {
                this.unsubscribe(channelName);

                delete this.channels[channelName];
            }
        });
    }

    /**
     * Subscribe to a Pusher channel.
     *
     * @param  {string} channel
     * @return {object}
     */
    subscribe(channel: string): any {
        return this.pusher.subscribe(channel);
    }

    /**
     * Unsubscribe from a Pusher channel.
     *
     * @param  {string} channel
     * @return {void}
     */
    unsubscribe(channel: string): void {
        this.pusher.unsubscribe(channel);
    }

    /**
     * Get the socket ID for the connection.
     *
     * @return {string}
     */
    socketId(): string {
        return this.pusher.connection.socket_id;
    }
}
