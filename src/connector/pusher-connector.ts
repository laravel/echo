import { Connector, type EchoOptionsWithDefaults } from './connector';
import { PusherChannel, PusherPrivateChannel, PusherEncryptedPrivateChannel, PusherPresenceChannel } from '../channel';
import type Pusher from 'pusher-js';
import type { Options as PusherOptions } from 'pusher-js';
import type { BroadcastDriver } from '../echo';

type AnyPusherChannel =
    | PusherChannel<BroadcastDriver>
    | PusherPrivateChannel<BroadcastDriver>
    | PusherEncryptedPrivateChannel<BroadcastDriver>
    | PusherPresenceChannel<BroadcastDriver>;

/**
 * This class creates a connector to Pusher.
 */
export class PusherConnector<TBroadcastDriver extends BroadcastDriver> extends Connector<
    TBroadcastDriver,
    PusherChannel<TBroadcastDriver>,
    PusherPrivateChannel<TBroadcastDriver>,
    PusherPresenceChannel<TBroadcastDriver>
> {
    /**
     * The Pusher instance.
     */
    pusher: Pusher;

    /**
     * All of the subscribed channel names.
     */
    channels: Record<string, AnyPusherChannel> = {};

    options: EchoOptionsWithDefaults<TBroadcastDriver> & {
        key: string;
        Pusher?: typeof Pusher;
    } & PusherOptions;

    /**
     * Create a fresh Pusher connection.
     */
    connect(): void {
        if (typeof this.options.client !== 'undefined') {
            this.pusher = this.options.client as Pusher;
        } else if (this.options.Pusher) {
            this.pusher = new this.options.Pusher(this.options.key, this.options);
        } else if (typeof window !== 'undefined' && typeof window.Pusher !== 'undefined') {
            this.pusher = new window.Pusher(this.options.key, this.options);
        } else {
            throw new Error('Pusher client not found. Should be globally available or passed via options.client');
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
    listen(name: string, event: string, callback: CallableFunction): AnyPusherChannel {
        return this.channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     */
    channel(name: string): AnyPusherChannel {
        if (!this.channels[name]) {
            this.channels[name] = new PusherChannel(this.pusher, name, this.options);
        }

        return this.channels[name];
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): PusherPrivateChannel<TBroadcastDriver> {
        if (!this.channels['private-' + name]) {
            this.channels['private-' + name] = new PusherPrivateChannel(this.pusher, 'private-' + name, this.options);
        }

        return this.channels['private-' + name] as PusherPrivateChannel<TBroadcastDriver>;
    }

    /**
     * Get a private encrypted channel instance by name.
     */
    encryptedPrivateChannel(name: string): PusherEncryptedPrivateChannel<TBroadcastDriver> {
        if (!this.channels['private-encrypted-' + name]) {
            this.channels['private-encrypted-' + name] = new PusherEncryptedPrivateChannel(
                this.pusher,
                'private-encrypted-' + name,
                this.options
            );
        }

        return this.channels['private-encrypted-' + name] as PusherEncryptedPrivateChannel<TBroadcastDriver>;
    }

    /**
     * Get a presence channel instance by name.
     */
    presenceChannel(name: string): PusherPresenceChannel<TBroadcastDriver> {
        if (!this.channels['presence-' + name]) {
            this.channels['presence-' + name] = new PusherPresenceChannel(
                this.pusher,
                'presence-' + name,
                this.options
            );
        }

        return this.channels['presence-' + name] as PusherPresenceChannel<TBroadcastDriver>;
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void {
        let channels = [name, 'private-' + name, 'private-encrypted-' + name, 'presence-' + name];

        channels.forEach((name: string) => {
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
