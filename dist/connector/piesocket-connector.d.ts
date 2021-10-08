import { Connector } from './connector';
import { PieSocketChannel, PieSocketPrivateChannel, PresenceChannel } from './../channel';
/**
 * This class creates a connector to PieSocket.
 */
export declare class PieSocketConnector extends Connector {
    /**
     * The PieSocket instance.
     */
    piesocket: any;
    /**
     * All of the subscribed channel names.
     */
    channels: any;
    /**
     * Create a fresh PieSocket connection.
     */
    connect(): void;
    /**
     * Listen for an event on a channel instance.
     */
    listen(name: string, event: string, callback: Function): PieSocketChannel;
    /**
     * Get a channel instance by name.
     */
    channel(name: string): PieSocketChannel;
    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): PieSocketPrivateChannel;
    presenceChannel(channel: string): PresenceChannel;
    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void;
    /**
     * Leave the given channel.
     */
    leaveChannel(name: string): void;
    /**
     * Get the socket ID for the connection.
     */
    socketId(): string;
    /**
     * Disconnect PieSocekt connections.
     */
    disconnect(): void;
}
