import {Connector} from './connector';

/**
 * This class creates a connnector to a Socket.io server.
 */
export class SocketIoConnector extends Connector {

    constructor(options) {
        super(options);
        /**
         * Socket.io connection.
         *
         * @type {object}
         */
        this.socket = {};
        /**
         * Name of event for updated members.
         *
         * @type {string}
         */
        this.updating = 'members:updated';

        /**
         * Name of event when member added.
         *
         * @type {string}
         */
        this.adding = 'member:added';

        /**
         * Name of event when member removed.
         *
         * @type {string}
         */
        this.removing = 'member:removed';

    }

    /**
     * Create a fresh Socket.io connection.
     *
     * @return object
     */
    connect() {
        super.connect();

        this.socket = io(this.options.host);

        return this.socket;
    }

    /**
     * Subscribe socket to a channel.
     *
     * @param  {string} channel
     * @return {object}
     */
    subscribe(channel) {
        super.subscribe(channel);

        return this.socket.emit('subscribe', {
            channel: channel,
            auth: this.options.auth || {}
        });
    }

    /**
     * Unsubscribe socket from a channel.
     *
     * @param  {string} channel
     * @return {void}
     */
    unsubscribe(channel) {
        super.unsubscribe(channel);

        this.socket.emit('unsubscribe', {
            channel: channel,
            auth: this.options.auth || {}
        });
    }

    /**
     * Get the socket_id of the connection.
     *
     * @return {string}
     */
    socketId() {
        super.socketId();

        return this.socket.id;
    }
}
