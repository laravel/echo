import { Connector } from './connector';
import { NullChannel, NullPrivateChannel, NullPresenceChannel, PresenceChannel } from './../channel';

/**
 * This class creates a null connector.
 */
export class NullConnector extends Connector {
    /**
     * All of the subscribed channel names.
     */
    channels: any = {};

    /**
     * Create a fresh connection.
     */
    connect(): void {
        //
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(name: string, event: string, callback: Function): NullChannel {
        return new NullChannel();
    }

    /**
     * Get a channel instance by name.
     */
    channel(name: string): NullChannel {
        return new NullChannel();
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): NullPrivateChannel {
        return new NullPrivateChannel();
    }

    /**
     * Get a private encrypted channel instance by name.
     */
    encryptedPrivateChannel(name: string): NullPrivateChannel {
        return new NullPrivateChannel();
    }

    /**
     * Get a presence channel instance by name.
     */
    presenceChannel(name: string): PresenceChannel {
        return new NullPresenceChannel();
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void {
        //
    }

    /**
     * Leave the given channel.
     */
    leaveChannel(name: string): void {
        //
    }

    /**
     * Get the socket ID for the connection.
     */
    socketId(): string {
        return 'fake-socket-id';
    }

    /**
     * Disconnect the connection.
     */
    disconnect(): void {
        //
    }
}
