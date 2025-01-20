import { Connector } from './connector';
import {
    PusherChannel,
    PusherPrivateChannel,
    PusherEncryptedPrivateChannel,
    PusherPresenceChannel,
} from './../channel';

type AnyPusherChannel = PusherChannel | PusherPrivateChannel | PusherEncryptedPrivateChannel | PusherPresenceChannel;

/**
 * This class creates a connector to Pusher.
 */
export class PusherConnector extends Connector<PusherChannel, PusherPrivateChannel, PusherPresenceChannel> {
    /**
     * The Pusher instance.
     */
    pusher: any;

    /**
     * All of the subscribed channel names.
     */
    channels: any = {};

    protected setOptions(options: any): any {
        this.options = super.setOptions(options);
        this.convertDeprecatedOptions();
        this.setAuthOptions();
        return this.options;
    }

    protected convertDeprecatedOptions(): any {
        const options = this.options;

        if (typeof options.authorizer !== 'undefined') {
            // We cannot use the channelAuthorization.customHandler if the authorizer is set,
            // sync the authorizer is build inside the Pusher (https://github.com/pusher/pusher-js/blob/37b057c45c403af27c79303123344c42f6da6a25/src/core/config.ts#L167)
            // and require the Pusher instance to be passed to the authorizer.

            // Convert all options to the deprecated format.
            options.authEndpoint ||= options.channelAuthorization.endpoint;
            options.authTransport ||= options.channelAuthorization.transport;
            options.auth ||= {};
            options.auth.headers ||= options.channelAuthorization.headers || {};
            options.auth.params ||= options.channelAuthorization.params || {};

            delete options.channelAuthorization;

            return;
        }

        // Backward compatibility for the authEndpoint option.
        // https://github.com/pusher/pusher-js/blob/37b057c45c403af27c79303123344c42f6da6a25/src/core/config.ts#L163
        if (typeof options.authEndpoint !== 'undefined') {
            options.channelAuthorization.endpoint = options.authEndpoint;
            options.authEndpoint = null;
        }

        // Backward compatibility for the authTransport option.
        // https://github.com/pusher/pusher-js/blob/37b057c45c403af27c79303123344c42f6da6a25/src/core/config.ts#L158
        if (typeof options.authTransport !== 'undefined') {
            options.channelAuthorization.transport = options.authTransport;
            options.authTransport = null;
        }

        // Backward compatibility for the auth option.
        // https://github.com/pusher/pusher-js/blob/37b057c45c403af27c79303123344c42f6da6a25/src/core/config.ts#L161
        if (typeof options.auth !== 'undefined') {
            options.channelAuthorization.headers = options.auth.headers || {};
            options.channelAuthorization.params = options.auth.params || {};
            options.auth = null;
        }

        return options;
    }

    protected setAuthOptions(): any {
        const options = this.options;

        const channelAuthKey = Object.prototype.hasOwnProperty.call(options, 'channelAuthorization')
          ? 'channelAuthorization'
          : 'auth';

        const csrfToken = this.csrfToken();
        if (csrfToken) {
            options[channelAuthKey].headers['X-CSRF-TOKEN'] = csrfToken;
            options.userAuthentication.headers['X-CSRF-TOKEN'] = csrfToken;
        }

        const bearerToken = options.bearerToken;
        if (bearerToken) {
            options[channelAuthKey].headers['Authorization'] = `Bearer ${bearerToken}`;
            options.userAuthentication.headers['Authorization'] = `Bearer ${bearerToken}`;
        }
    }

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
    listen(name: string, event: string, callback: Function): AnyPusherChannel {
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
    privateChannel(name: string): PusherPrivateChannel {
        if (!this.channels['private-' + name]) {
            this.channels['private-' + name] = new PusherPrivateChannel(this.pusher, 'private-' + name, this.options);
        }

        return this.channels['private-' + name];
    }

    /**
     * Get a private encrypted channel instance by name.
     */
    encryptedPrivateChannel(name: string): PusherEncryptedPrivateChannel {
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
    presenceChannel(name: string): PusherPresenceChannel {
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
