import { Connector } from './connector';

import { AblyChannel, AblyPrivateChannel, AblyPresenceChannel, AblyAuth } from './../channel';
import { AblyRealtime } from '../../typings/ably';

/**
 * This class creates a connector to Ably.
 */
export class AblyConnector extends Connector {

    /**
     * The laravel-echo library version.
     */
    static LIB_VERSION = '1.0.2';
    
    /**
     * The Ably instance.
     */
    ably: AblyRealtime;

    /**
     * All of the subscribed channel names.
     */
    channels: Record<string, AblyChannel> = {};

    /**
     * Auth instance containing all explicit channel authz ops.
     */
    ablyAuth: AblyAuth;

    /**
     * Create a fresh Ably connection.
     */
    connect(): void {
        if (typeof this.options.client !== 'undefined') {
            this.ably = this.options.client;
        } else {
            this.ablyAuth = new AblyAuth(this.options);
            if (!this.options.agents) {
                this.options.agents = {};
            }
            this.options.agents['laravel-echo'] = AblyConnector.LIB_VERSION;
            this.ably = new Ably.Realtime({ ...this.ablyAuth.options, ...this.options });
            this.ablyAuth.enableAuthorizeBeforeChannelAttach(this);
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
            this.channels[prefixedName] = new AblyChannel(this.ably, prefixedName, this.options);
        }

        return this.channels[prefixedName];
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): AblyPrivateChannel {
        const prefixedName = `private:${name}`; // adding private as a ably namespace prefix
        if (!this.channels[prefixedName]) {
            this.channels[prefixedName] = new AblyPrivateChannel(this.ably, prefixedName, this.options, this.ablyAuth);
        }

        return this.channels[prefixedName] as AblyPrivateChannel;
    }

    /**
     * Get a presence channel instance by name.
     */
    presenceChannel(name: string): AblyPresenceChannel {
        const prefixedName = `presence:${name}`; // adding presence as a ably namespace prefix
        if (!this.channels[prefixedName]) {
            this.channels[prefixedName] = new AblyPresenceChannel(this.ably, prefixedName, this.options, this.ablyAuth);
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
        if (name.indexOf('public:') !== 0 && name.indexOf('private:') !== 0 && name.indexOf('presence:') !== 0) {
            throw new Error(
                `Error leaving ${name}, name should be prefixed with either "public:", "private:" or "presence:"`
            );
        }
        if (this.channels[name]) {
            this.channels[name].unsubscribe();
            this.ablyAuth.setExpired(name);
            delete this.channels[name];
        }
    }

    /**
     * Get the socket ID for the connection.
     */
    socketId(): string {
        return this.ably.connection.key;
    }

    /**
     * Disconnect Ably connection.
     */
    disconnect(): void {
        this.ably.close();
    }
}
