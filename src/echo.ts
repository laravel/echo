import {EventFormatter} from './util';
import {Channel, PresenceChannel} from './channel'
import {PusherConnector, SocketIoConnector} from './connector';

/**
 * This class is the primary API for interacting with broadcasting.
 */
class Echo {

    /**
     * The broadcasting connector.
     *
     * @type {object}
     */
    connector: any;

    /**
     * The Echo options.
     *
     * @type {array}
     */
    options: any;

    /**
     * Create a new class instance.
     *
     * @param  {object} options
     */
    constructor(options: any) {
        this.options = options;

        if (this.options.connector == 'pusher') {
            this.connector = new PusherConnector(this.options);
        } else if (this.options.connector == 'socket.io') {
            this.connector = new SocketIoConnector(this.options);
        }
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(channel: string, event: string, callback: Function) {
        return this.connector.listen(channel, event, callback);
    }

    /**
     * Get a private channel instance by name.
     *
     * @param  {string} channel
     * @return {object}
     */
    private(channel: string): Channel {
        return this.channel('private-' + channel);
    }

    /**
     * Get a presence channel instance by name.
     *
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
     * Leave the given channel.
     *
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
     *
     * @return {string}
     */
    socketId(): string {
        return this.connector.socketId();
    }
}

module.exports = Echo;
