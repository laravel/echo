import { Connector } from './connector';
import {
    PusherChannel,
    PusherPrivateChannel,
    PusherEncryptedPrivateChannel,
    PusherPresenceChannel,
    PresenceChannel,
} from './../channel';

/**
 * This class creates a connector to Pusher.
 */
export class PusherConnector extends Connector {
    /**
     * The Pusher instance.
     */
    pusher: any;

    /**
     * All of the subscribed channel names.
     */
    channels: any = {};

    /**
     * Create a fresh Pusher connection.
     */
    connect(): void {
        if (typeof this.options.client !== 'undefined') {
            this.pusher = this.options.client;
        } else if (this.options.Pusher) {
            this.pusher = new this.options.Pusher(this.options.key, this.options);
        } else {
            this.pusher = new Pusher(this.options.key, this.options);
        }
    }

    /**
     * Sign in the user via Pusher user authentication (https://pusher.com/docs/channels/using_channels/user-authentication/).
     */
    signin(): void {
        this.pusher.signin();
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(name: string, event: string, callback: Function): PusherChannel {
        return this.channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     */
    channel(name: string): PusherChannel {
        if (!this.channels[name]) {
            this.channels[name] = new PusherChannel(this.pusher, name, this.options);
        }

        return this.channels[name];
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): PusherChannel {
        if (!this.channels['private-' + name]) {
            this.channels['private-' + name] = new PusherPrivateChannel(this.pusher, 'private-' + name, this.options);
        }

        return this.channels['private-' + name];
    }

    /**
     * Get a private encrypted channel instance by name.
     */
    encryptedPrivateChannel(name: string): PusherChannel {
        if (!this.channels['private-encrypted-' + name]) {
            this.channels['private-encrypted-' + name] = new PusherEncryptedPrivateChannel(
                this.pusher,
                'private-encrypted-' + name,
                this.options
            );
        }

        return this.channels['private-encrypted-' + name];
    }

    /**
     * Get a presence channel instance by name.
     */
    presenceChannel(name: string): PresenceChannel {
        if (!this.channels['presence-' + name]) {
            this.channels['presence-' + name] = new PusherPresenceChannel(
                this.pusher,
                'presence-' + name,
                this.options
            );
        }

        return this.channels['presence-' + name];
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void {
        let channels = [name, 'private-' + name, 'private-encrypted-' + name, 'presence-' + name];

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
        return this.pusher.connection.socket_id;
    }

    /**
     * Disconnect Pusher connection.
     */
    disconnect(): void {
        this.pusher.disconnect();
    }
}
