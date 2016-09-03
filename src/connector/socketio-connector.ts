import { Connector } from './connector';
import { SocketIoChannel, SocketIoPresenceChannel } from './../channel';

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
     * @type {array}
     */
    channels: any[] = [];

    /**
     * Create a fresh Socket.io connection.
     *
     * @return void
     */
    connect(): void {
        this.socket = io(this.options.host, this.options.socketIoOptions);

        return this.socket;
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
     * @return {SocketIoChannel}
     */
    channel(channel: string): SocketIoChannel {
        return new SocketIoChannel(this.createChannel(channel), this.options);
    }

    /**
     * Get a private channel instance by name.
     *
     * @param  {string}  channel
     * @return {SocketIoChannel}
     */
    privateChannel(channel: string): SocketIoChannel {
        return new SocketIoChannel(this.createChannel('private-' + channel), this.options);
    }

    /**
     * Get a presence channel instance by name.
     *
     * @param  {string} channel
     * @return {PresenceChannel}
     */
    presenceChannel(channel: string): SocketIoPresenceChannel {
        return new SocketIoPresenceChannel(this.createChannel('presence-' + channel), this.options);
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
     * Subscribe to a Socket.io channel.
     *
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
     * Unsubscribe from a Socket.io channel.
     *
     * @param  {string} channel
     * @return {void}
     */
    unsubscribe(channel: string): void {
        this.socket.removeAllListeners();

        this.socket.emit('unsubscribe', {
            channel: channel,
            auth: this.options.auth || {}
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
}
