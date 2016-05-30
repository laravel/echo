import {Connector} from './connector';

/**
 * This class creates a connnector to a Socket.io server.
 */
export class SocketIoConnector extends Connector {

    /**
     * Socket.io connection
     * @type {object}
     */
    socket: any;

    /**
     * Name of event for updated members.
     * @type {string}
     */
    updating: string = 'members:updated';

    /**
     * Name of event when member added.
     * @type {string}
     */
    adding: string = 'member:added';

    /**
     * Name of event when member removed.
     * @type {string}
     */
    removing: string = 'member:removed';

    /**
     * Create a fresh Socket.io connection.
     * @return void
     */
    connect(): void {
        this.socket = io(this.options.host);

        return this.socket;
    }

    /**
     * Subscribe socket to a channel.
     * @param  {string} channel
     * @return {object}
     */
    subscribe(channel: string): any {
        return this.socket.emit('subscribe', {
            channel: channel,
            auth: this.options.auth || {}
        });
    }

    /**
     * Unsubscribe socket from a channel.
     * @param  {string} channel
     * @return {void}
     */
    unsubscribe(channel: string): void {
        this.socket.emit('unsubscribe', {
            channel: channel,
            auth: this.options.auth || {}
        });
    }

    /**
     * Get the socket_id of the connection.
     * @return {string}
     */
    socketId(): string {
        return this.socket.id;
    }
}
