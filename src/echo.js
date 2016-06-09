import {Channel} from './channel/channel'
import {PresenceChannel} from './channel/presence-channel';
import {PusherConnector} from './connector/pusher-connector';
import {SocketIoConnector} from './connector/socketio-connector';

/**
 * This class is the primary API for interacting with broadcasting.
 */
export default class Echo {

    /**
     * Create a new class instance.
     *
     * @param  {object} options
     */
    constructor(options) {
        /**
         * Channel names.
         *
         * @type {Array}
         */
        this.channels = [];
        /**
         * The broadcasting connector.
         *
         * @type {object}
         */
        this.connector = {};

        if (options.connector == 'pusher') {
            this.connector = new PusherConnector(options);
        } else if (options.connector == 'socket.io') {
            this.connector = new SocketIoConnector(options);
        }
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(channel, event, callback) {
        return this.channel(channel).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     *
     * @param  {string}  channel
     * @return {Channel}
     */
    channel(channel) {
        return new Channel(
            this.createChannel(channel),
            this.connector
        );
    }

    /**
     * Get a private channel instance by name.
     *
     * @param  {string} channel
     * @return {object}
     */
    private(channel) {
        return this.channel('private-' + channel);
    }

    /**
     * Get a presence channel instance by name.
     *
     * @param  {string} channel
     * @return {PresenceChannel}
     */
    join(channel) {
        return new PresenceChannel(
            this.createChannel('presence-' + channel),
            this.connector
        );
    }

    /**
     * Create an subscribe to a fresh channel instance.
     *
     * @param  {string} channel
     * @return {object}
     */
    createChannel(channel) {
        if (!this.channels[channel]) {
            this.channels[channel] = this.connector.subscribe(channel);
        }

        return this.channels[channel];
    }

    /**
     * Leave the given channel.
     *
     * @param  {string} channel
     */
    leave(channel) {
        let channels = [channel, 'private-' + channel, 'presence-' + channel];

        channels.forEach((channelName, index) => {
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
    socketId() {
        return this.connector.socketId();
    }
}

