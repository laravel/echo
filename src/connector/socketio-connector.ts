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
        this.socket = io(this.options.host);

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
        return new SocketIoChannel(
            channel,
            this.createChannel(channel),
            this.options
        );
    }

    /**
     * Get a private channel instance by name.
     *
     * @param  {string}  channel
     * @return {SocketIoChannel}
     */
    privateChannel(channel: string): SocketIoChannel {
        return new SocketIoChannel(
            channel,
            this.createChannel('private-' + channel),
            this.options
        );
    }

    /**
     * Get a presence channel instance by name.
     *
     * @param  {string} channel
     * @return {PresenceChannel}
     */
    presenceChannel(channel: string): SocketIoPresenceChannel {
        return new SocketIoPresenceChannel(
            channel,
            this.createChannel('presence-' + channel),
            this.options
        );
    }

    /**
     * Create and subscribe to a fresh channel instance.
     *
     * @param  {string} channel
     * @return {object}
     */
    createChannel(channel: string): any {
        if (!this.channels[channel]) {
            this.channels[channel] = {
                channel: this.subscribe(channel)
            };
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
                this.clearCallbacks(channelName);

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

    private clearCallbacks(channelName: string) {
        let channel = this.channels[channelName]['channel'];
        let events = this.channels[channelName]['events'];

        for (let event in events) {
            events[event].forEach(callback => {
                channel.removeListener(event, callback)
            });
        }
    }
}
