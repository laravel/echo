import { Connector } from './connector';
import { CentrifugePresenceChannel, CentrifugeChannel } from '../channel';

/**
 * This class creates a connnector to a Centrifugal server.
 */
export class CentrifugeConnector extends Connector {
    /**
     * The Socket.io connection instance.
     * @type Centrifuge
     */
    centrifuge: any;

    /**
     * All of the subscribed channel names.
     */
    channels: { [name: string]: CentrifugePresenceChannel } = {};

    /**
     * Create a fresh Socket.io connection.
     */
    connect(): void {
        if (typeof this.options.client !== 'undefined') {
            this.centrifuge = this.options.client;
        } else if (this.options.Centrifuge) {
            this.centrifuge = new this.options.Centrifuge(this.options.host, this.options);
        } else if ('Centrifuge' in window) {
            this.centrifuge = new Centrifuge(this.options.host, this.options);
        } else {
            throw new Error(
                'Centrifuge-js client not found. Should be globally available or passed via options.client'
            );
        }

        this.centrifuge.connect();
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(name: string, event: string, callback: Function): CentrifugeChannel {
        return this.channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     */
    channel(name: string): CentrifugeChannel {
        if (!this.channels[name]) {
            this.channels[name] = new CentrifugePresenceChannel(this.centrifuge, name, this.options);
        }

        return this.channels[name];
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): CentrifugeChannel {
        return this.channel(name);
    }

    /**
     * Get a presence channel instance by name.
     */
    presenceChannel(name: string): CentrifugePresenceChannel {
        if (!this.channels[name]) {
            this.channels[name] = new CentrifugePresenceChannel(this.centrifuge, name, this.options);
        }

        return this.channels[name];
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void {
        let channels = [name, 'private-' + name, 'presence-' + name];

        channels.forEach((name) => {
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
     * Disconnect Socketio connection.
     */
    disconnect(): void {
        this.centrifuge.disconnect();
    }

    socketId(): string {
        return '';
    }
}
