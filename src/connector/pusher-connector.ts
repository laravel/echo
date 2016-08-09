import {Connector} from './connector';
import {PusherChannel, PusherPresenceChannel} from './../channel';

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
        let pusher = new Pusher(this.options.pusherKey, this.options);

        let url = ( this.options.host ? this.options.host : '' ) + '/broadcasting/socket';

        pusher.connection.bind('connected', () => {
            var request = new XMLHttpRequest();
            request.open('POST', url, true);
            request.setRequestHeader('Content-Type', 'application/json');
            request.setRequestHeader('X-CSRF-Token', this.csrfToken());
            request.send(JSON.stringify({
                "socket_id": pusher.connection.socket_id
            }));
        });

        this.pusher = pusher;
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
        return new PusherChannel(this.createChannel(channel), this);
    }

    /**
     * Get a private channel instance by name.
     *
     * @param  {string}  channel
     * @return {PusherChannel}
     */
    privateChannel(channel: string): PusherChannel {
        return new PusherChannel(this.createChannel('private-' + channel), this);
    }

    /**
     * Get a presence channel instance by name.
     *
     * @param  {string} channel
     * @return {EchoPresenceChannel}
     */
    presenceChannel(channel: string): PresenceChannel {
        return new PusherPresenceChannel(this.createChannel('presence-' + channel), this);
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
     * Subscribe to a channel.
     *
     * @param  {string} channel
     * @return {object}
     */
    subscribe(channel: string): any {
        return this.pusher.subscribe(channel);
    }

    /**
     * Unsubscribe from a channel.
     *
     * @param  {string} channel
     * @return {void}
     */
    unsubscribe(channel: string): void {
        this.pusher.unsubscribe(channel);
    }

    /**
     * Get the socket_id of the connection.
     *
     * @return {string}
     */
    socketId(): string {
        return this.pusher.connection.socket_id;
    }
}
