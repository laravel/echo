import {EventFormatter} from './util';
import {Channel, PresenceChannel} from './channel'
import {PusherConnector, SocketIoConnector} from './connector';

/**
 * This class is the primary API for interacting with broadcasting.
 */
export default class Echo {

    /**
     * Channel names.
     * @type {array}
     */
    channels: any[] = [];

    /**
     * The broadcasting connector.
     * @type {object}
     */
    connector: any;

    /**
     * Create a new class instance.
     * @param  {object} options
     */
    constructor(options: any) {
        if (options.connector == 'pusher') {
            this.connector = new PusherConnector(options);
        } else if (options.connector == 'socket.io') {
            this.connector = new SocketIoConnector(options);
        }
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(channel: string, event: string, callback: Function) {
        return this.channel(channel).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     * @param  {string}  channel
     * @return {Channel}
     */
    channel(channel: string): Channel {
        return new Channel(
            this.createChannel(channel),
            this.connector
        );
    }

    /**
     * Get a private channel instance by name.
     * @param  {string} channel
     * @return {object}
     */
    private(channel: string): Channel {
        return this.channel('private-' + channel);
    }

    /**
     * Get a presence channel instance by name.
     * @param  {string} channel
     * @return {EchoPresenceChannel}
     */
    join(channel: string): PresenceChannel {
        return new PresenceChannel(
            this.createChannel('presence-' + channel),
            this.connector
        );
    }

    /**
     * Create an subscribe to a fresh channel instance.
     * @param  {string} channel
     * @return {object}
     */
    createChannel(channel: string): any {
        if (!this.channels[channel]) {
            this.channels[channel] = this.connector.subscribe(channel);
        }

        return this.channels[channel];
    }

    /**
     * Leave the given channel.
     * @param  {string} channel
     */
    leave(channel: string) {
        let channels = [channel, 'private-' + channel, 'presence-' + channel];

        channels.forEach((channelName: string, index: number) => {
            if (this.channels[channelName]) {
                this.connector.unsubscribe(channelName);

                delete this.channels[channelName];
            }
        });
    }

    /**
     * Get the Socket ID for the connection.
     * @return {string}
     */
    socketId(): string {
        return this.connector.socketId();
    }

    /**
     * Set the default event namespace.
     * @param  {string} value
     */
    namespace(value: string) {
        // REVIEW: When does this come into play?
        EventFormatter.defaultNamespace = value;
    }
}

module.exports = Echo;
