import { Connector } from './connector';
import {
    PieSocketChannel,
    PieSocketPrivateChannel,
    PieSocketPresenceChannel,
    PresenceChannel,
} from './../channel';

/**
 * This class creates a connector to PieSocket.
 */
export class PieSocketConnector extends Connector {
    /**
     * The PieSocket instance.
     */
    piesocket: any;

    /**
     * All of the subscribed channel names.
     */
    channels: any = {};

    /**
     * Create a fresh PieSocket connection.
     */
    connect(): void {
        if (typeof this.options.client !== 'undefined') {
            this.piesocket = this.options.client;
        } else {
            const requiredOptions = {
                clusterId: this.options.cluster,
                apiKey: this.options.key
            };
            const options = {...requiredOptions, ...this.options};
            this.piesocket = new PieSocket(options);
        }
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(name: string, event: string, callback: Function): PieSocketChannel {
        return this.channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     */
    channel(name: string): PieSocketChannel {
        if (!this.channels['public-' + name]) {
            this.channels['public-' + name] = new PieSocketChannel(this.piesocket, 'public-' + name, this.options);
        }

        return this.channels['public-' + name];
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): PieSocketPrivateChannel {
        if (!this.channels['private-' + name]) {
            this.channels['private-' + name] = new PieSocketPrivateChannel(this.piesocket, 'private-' + name, this.options);
        }

        return this.channels['private-' + name];
    }

    presenceChannel(channel: string): PresenceChannel {
        if (!this.channels['presence-' + channel]) {
            this.channels['presence-' + channel] = new PieSocketPresenceChannel(
                this.piesocket,
                'presence-' + channel,
                this.options
            );
        }

        return this.channels['presence-' + channel];
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void {
        let channels = ['public-' + name, 'private-' + name, 'presence-' + name];

        channels.forEach((name: string, index: number) => {
            this.leaveChannel(name);
        });
    }

    /**
     * Leave the given channel.
     */
    leaveChannel(name: string): void {
        if (this.channels[name]) {
            this.channels[name].unsubscribe();

            delete this.channels[name];
        }
    }

    /**
     * Get the socket ID for the connection.
     */
    socketId(): string {
        return "none";
    }

    /**
     * Disconnect PieSocekt connections.
     */
    disconnect(): void {
        this.piesocket.disconnect();
    }
}
