import { EventFormatter } from '../util';
import { Channel } from './channel';
/**
 * This class represents a PieSocket channel.
 */
export declare class PieSocketChannel extends Channel {
    /**
     * The PieSocket client instance.
     */
    piesocket: any;
    /**
     * Events to listen for
     */
    events: object;
    /**
     * The name of the channel.
     */
    name: any;
    /**
     * Channel options.
     */
    options: any;
    /**
     * The event formatter.
     */
    eventFormatter: EventFormatter;
    /**
     * The subscription of the channel.
     */
    subscription: any;
    /**
     * Create a new class instance.
     */
    constructor(piesocket: any, name: any, options: any);
    /**
     * Subscribe to a PieSocket channel.
     */
    subscribe(): any;
    /**
     * Handle incoming messages
     */
    handleMessages(messageEvent: any): void;
    getEventName(formattedEvent: any): any;
    /**
     * Unsubscribe from a PieSocket channel.
     */
    unsubscribe(): void;
    /**
     * Listen for an event on the channel instance.
     */
    listen(event: string, callback: Function): PieSocketChannel;
    /**
     * Listen for all events on the channel instance.
     */
    listenToAll(callback: Function): PieSocketChannel;
    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: Function): PieSocketChannel;
    /**
     * Stop listening for all events on the channel instance.
     */
    stopListeningToAll(callback?: Function): PieSocketChannel;
    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: Function): PieSocketChannel;
    /**
     * Register a callback to be called anytime a subscription error occurs.
     */
    error(callback: Function): PieSocketChannel;
    /**
     * Register a callback to be called anytime a subscription is closed.
     */
    closed(callback: Function): PieSocketChannel;
    /**
     * Publish from client
     * C2C communication must be enable from PieSocket API settings
     */
    publish(eventName: string, data: any): PieSocketChannel;
    /**
     * Bind a channel to an event.
     */
    on(event: string, callback: Function): PieSocketChannel;
}
