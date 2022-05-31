import { Connector } from './connector';
import { AblyChannel } from '../channel/ably-channel';
import { AblyPrivateChannel } from '../channel/ably-private-channel';
import * as AblyImport from 'ably';
import { AblyPresenceChannel } from '../channel/ably-presence-channel';

/**
 * This class creates a connector to Ably.
 */
export class AblyConnector extends Connector {
    /**
     * The Ably instance.
     */
    ably: AblyImport.Types.RealtimeCallbacks;

    /**
     * All of the subscribed channel names.
     */
    channels: Record<string, AblyChannel> = {};

    /**
     * Create a fresh Ably connection.
     */
    connect(): void {
        if (typeof this.options.client !== 'undefined') {
            this.ably = this.options.client;
        } else {
            this.ably = new Ably.Realtime(this.options);
        }
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(name: string, event: string, callback: Function): AblyChannel {
        return this.channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     */
    channel(name: string): AblyChannel {
        const prefixedName = `public:${name}`; // adding public as a ably namespace prefix
        if (!this.channels[prefixedName]) {
            this.channels[prefixedName] = new AblyChannel(this.ably, name, this.options);
        }

        return this.channels[prefixedName];
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): AblyPrivateChannel {
        const prefixedName = `private:${name}`; // adding private as a ably namespace prefix
        if (!this.channels[prefixedName]) {
            this.channels[prefixedName] = new AblyPrivateChannel(this.ably, name, this.options);
        }

        return this.channels[prefixedName] as AblyPrivateChannel;
    }

    /**
    * Get a presence channel instance by name.
    */
    presenceChannel(name: string): AblyPresenceChannel {
        const prefixedName = `presence:${name}`; // adding presence as a ably namespace prefix
        if (!this.channels[prefixedName]) {
            this.channels[prefixedName] = new AblyPresenceChannel(this.ably, name, this.options);
        }

        return this.channels[prefixedName] as AblyPresenceChannel;
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void {
        let channels = [`public:${name}`, `private:${name}`, `presence:${name}`];

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
        return this.ably.connection.id;
    }

    /**
     * Disconnect Ably connection.
     */
    disconnect(): void {
        this.ably.close();
    }
}
