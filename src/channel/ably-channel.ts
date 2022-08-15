import { AblyRealtime, AblyRealtimeChannel } from '../../typings/ably';
import { EventFormatter } from '../util';
import { Channel } from './channel';

/**
 * This class represents an Ably channel.
 */
export class AblyChannel extends Channel {
    /**
     * The Ably client instance.
     */
    ably: AblyRealtime;

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
    channel: AblyRealtimeChannel;

    /**
     * An array containing all registered subscribed listeners.
     */
    subscribedListeners: Function[];

    /**
     * An array containing all registered error listeners.
     */
    errorListeners: Function[];

    /**
     * Channel event subscribe callbacks, maps callback to modified implementation.
     */
    callbacks: Map<Function, Function>;

    /**
     * Create a new class instance.
     */
    constructor(ably: any, name: string, options: any, autoSubscribe = true) {
        super();

        this.name = name;
        this.ably = ably;
        this.options = options;
        this.eventFormatter = new EventFormatter(this.options.namespace);
        this.subscribedListeners = [];
        this.errorListeners = [];
        this.channel = ably.channels.get(name);
        this.callbacks = new Map();

        if (autoSubscribe) {
            this.subscribe();
        }
    }

    /**
     * Subscribe to an Ably channel.
     */
    subscribe(): any {
        this.channel.on((stateChange) => {
            const { previous, current, reason } = stateChange;
            if (previous !== 'attached' && current == 'attached') {
                this.subscribedListeners.forEach((listener) => listener());
            } else if (reason) {
                this._alertErrorListeners(stateChange);
            }
        });
        this.channel.attach(this._alertErrorListeners);
    }

    /**
     * Unsubscribe from an Ably channel, unregister all callbacks and finally detach the channel
     */
    unsubscribe(): void {
        this.channel.unsubscribe();
        this.callbacks.clear();
        this.unregisterError();
        this.unregisterSubscribed();
        this.channel.off();
        this.channel.detach();
    }

    /**
     * Listen for an event on the channel instance.
     */
    listen(event: string, callback: Function): AblyChannel {
        this.callbacks.set(callback, ({ data, ...metaData }) => callback(data, metaData));
        this.channel.subscribe(this.eventFormatter.format(event), this.callbacks.get(callback) as any);
        return this;
    }

    /**
     * Listen for all events on the channel instance.
     */
    listenToAll(callback: Function): AblyChannel {
        this.callbacks.set(callback, ({ name, data, ...metaData }) => {
            let namespace = this.options.namespace.replace(/\./g, '\\');

            let formattedEvent = name.startsWith(namespace) ? name.substring(namespace.length + 1) : '.' + name;

            callback(formattedEvent, data, metaData);
        });
        this.channel.subscribe(this.callbacks.get(callback) as any);
        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: Function): AblyChannel {
        if (callback) {
            this.channel.unsubscribe(this.eventFormatter.format(event), this.callbacks.get(callback) as any);
            this.callbacks.delete(callback);
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
            this.channel.unsubscribe(this.callbacks.get(callback) as any);
            this.callbacks.delete(callback);
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

    /**
     * Unregisters given error callback from the listeners.
     * @param callback
     * @returns AblyChannel
     */
    unregisterSubscribed(callback?: Function): AblyChannel {
        if (callback) {
            this.subscribedListeners = this.subscribedListeners.filter((s) => s != callback);
        } else {
            this.subscribedListeners = [];
        }

        return this;
    }

    /**
     * Unregisters given error callback from the listeners.
     * @param callback
     * @returns AblyChannel
     */
    unregisterError(callback?: Function): AblyChannel {
        if (callback) {
            this.errorListeners = this.errorListeners.filter((e) => e != callback);
        } else {
            this.errorListeners = [];
        }

        return this;
    }

    _alertErrorListeners = (err: any) => {
        if (err) {
            this.errorListeners.forEach((listener) => listener(err));
        }
    };
}
