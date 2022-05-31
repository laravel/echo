import { EventFormatter } from '../util';
import { Channel } from './channel';
import * as AblyImport from 'ably';

/**
 * This class represents an Ably channel.
 */
export class AblyChannel extends Channel {
    /**
     * The Ably client instance.
     */
    ably: AblyImport.Types.RealtimeCallbacks;

    /**
     * The name of the channel.
     */
    name: string;

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
    channel: AblyImport.Types.RealtimeChannelCallbacks;

    /**
     * An array containing all registered subscribed listeners.
     */
    subscribedListeners: Function[];

    /**
     * An array containing all registered error listeners.
     */
    errorListeners: Function[];

    /**
     * Create a new class instance.
     */
    constructor(ably: any, name: string, options: any) {
        super();

        this.name = name;
        this.ably = ably;
        this.options = options;
        this.eventFormatter = new EventFormatter(this.options.namespace);
        this.subscribedListeners = [];
        this.errorListeners = [];

        this.subscribe();
    }

    /**
     * Subscribe to an Ably channel.
     */
    subscribe(): any {
        this.channel = this.ably.channels.get(this.name);
        this.channel.on(({ current, reason }) => {
            if (current == 'attached') {
                this.subscribedListeners.forEach(listener => listener());
            } else if (reason) {
                this._publishErrors(reason);
            }
        });
        this.channel.attach();
    }

    /**
     * Unsubscribe from an Ably channel.
     */
    unsubscribe(): void {
        this.channel.unsubscribe();
        this.channel.detach();
    }

    /**
     * Listen for an event on the channel instance.
     */
    listen(event: string, callback: Function): AblyChannel {
        this.channel.subscribe(event, callback as any);

        return this;
    }

    /**
     * Listen for all events on the channel instance.
     */
    listenToAll(callback: Function): AblyChannel {
        this.channel.subscribe(({ name, data }) => {
            let namespace = this.options.namespace.replace(/\./g, '\\');

            let formattedEvent = name.startsWith(namespace) ? name.substring(namespace.length + 1) : '.' + event;

            callback(formattedEvent, data);
        });

        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: Function): AblyChannel {
        if (callback) {
            this.channel.unsubscribe(this.eventFormatter.format(event), callback as any);
        } else {
            this.channel.unsubscribe(this.eventFormatter.format(event));
        }

        return this;
    }

    /**
     * Stop listening for all events on the channel instance.
     */
    stopListeningToAll(callback?: Function): AblyChannel {
        if (callback) {
            this.channel.unsubscribe(callback as any);
        } else {
            this.channel.unsubscribe();
        }

        return this;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: Function): AblyChannel {
        this.subscribedListeners.push(callback);

        return this;
    }

    /**
     * Register a callback to be called anytime a subscription error occurs.
     */
    error(callback: Function): AblyChannel {
        this.errorListeners.push(callback);

        return this;
    }

    _publishErrors = (err) => {
        this.errorListeners.forEach(listener => listener(err));
    }
}
