import {
    NullChannel,
    NullEncryptedPrivateChannel,
    NullPresenceChannel,
    NullPrivateChannel,
} from "../channel";
import type { ConnectionStatus } from "../echo";
import { Connector } from "./connector";

/**
 * This class creates a null connector.
 */
export class NullConnector extends Connector<
    "null",
    NullChannel,
    NullPrivateChannel,
    NullPresenceChannel
> {
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
    listen(
        _name: string,
        _event: string,
        _callback: CallableFunction,
    ): NullChannel {
        return new NullChannel();
    }

    /**
     * Get a channel instance by name.
     */
    channel(_name: string): NullChannel {
        return new NullChannel();
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(_name: string): NullPrivateChannel {
        return new NullPrivateChannel();
    }

    /**
     * Get a private encrypted channel instance by name.
     */
    encryptedPrivateChannel(_name: string): NullEncryptedPrivateChannel {
        return new NullEncryptedPrivateChannel();
    }

    /**
     * Get a presence channel instance by name.
     */
    presenceChannel(_name: string): NullPresenceChannel {
        return new NullPresenceChannel();
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(_name: string): void {
        //
    }

    /**
     * Leave the given channel.
     */
    leaveChannel(_name: string): void {
        //
    }

    /**
     * Get the socket ID for the connection.
     */
    socketId(): string {
        return "fake-socket-id";
    }

    /**
     * Get the current connection status.
     */
    connectionStatus(): ConnectionStatus {
        return "connected";
    }

    /**
     * Subscribe to connection status changes.
     */
    onConnectionChange(
        _callback: (status: ConnectionStatus) => void,
    ): () => void {
        // Null connector always returns "connected" and never changes

        return () => {
            // No-op cleanup
        };
    }

    /**
     * Disconnect the connection.
     */
    disconnect(): void {
        //
    }
}
