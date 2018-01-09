import { Connector } from './connector';
import { SocketIoChannel, SocketIoPrivateChannel, SocketIoPresenceChannel } from './../channel';

/**
 * This class creates a connnector to a Socket.io server.
 */
export class SocketIoConnector extends Connector {
    /**
     * The Socket.io connection instance.
     *
     * @type {object}
     */
    socket: any;

    /**
     * All of the subscribed channel names.
     *
     * @type {any}
     */
    channels: any = {};

    /**
     * Create a fresh Socket.io connection.
     *
     * @return void
     */
    connect(): void {
        let io = this.getSocketIO();

        this.socket = io(this.options.host, this.options);

        return this.socket;
    }

    /**
     * Get socket.io module from global scope or options.
     *
     * @type {object}
     */
    getSocketIO(): any {
        if (typeof io !== 'undefined') {
            return io;
        }

        if (this.options.client !== 'undefined') {
            return this.options.client;
        }

        throw new Error('Socket.io client not found. Should be globally available or passed via options.client');
    }

    /**
     * Listen for an event on a channel instance.
     *
     * @param  {string} name
     * @param  {string} event
     * @param  {Function} callback
     * @return {SocketIoChannel}
     */
    listen(name: string, event: string, callback: Function): SocketIoChannel {
        return this.channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     *
     * @param  {string} name
     * @return {SocketIoChannel}
     */
    channel(name: string): SocketIoChannel {
        if (!this.channels[name]) {
            this.channels[name] = new SocketIoChannel(
                this.socket,
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
     * @return {SocketIoChannel}
     */
    privateChannel(name: string): SocketIoPrivateChannel {
        if (!this.channels['private-' + name]) {
            this.channels['private-' + name] = new SocketIoPrivateChannel(
                this.socket,
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
     * @return {SocketIoPresenceChannel}
     */
    presenceChannel(name: string): SocketIoPresenceChannel {
        if (!this.channels['presence-' + name]) {
            this.channels['presence-' + name] = new SocketIoPresenceChannel(
                this.socket,
                'presence-' + name,
                this.options
            );
        }

        return this.channels['presence-' + name];
    }

    /**
     * Leave the given channel.
     *
     * @param  {string} name
     * @return {void}
     */
    leave(name: string): void {
        let channels = [name, 'private-' + name, 'presence-' + name];

        channels.forEach(name => {
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
        return this.socket.id;
    }

    /**
     * Disconnect Socketio connection.
     *
     * @return void
     */
    disconnect(): void {
        this.socket.disconnect();
    }
}
