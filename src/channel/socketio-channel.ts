import { EventFormatter } from '../util';
import { Channel } from './channel';

/**
 * This class represents a Socket.io channel.
 */
export class SocketIoChannel extends Channel {
    /**
     * The Socket.io client instance.
     */
    socket: any;

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
     * The event callbacks applied to the socket.
     */
    events: any = {};

    /**
     * User supplied callbacks for events on this channel.
     */
    private listeners: any = {};

    /**
     * Create a new class instance.
     */
    constructor(socket: any, name: string, options: any) {
        super();

        this.name = name;
        this.socket = socket;
        this.options = options;
        this.eventFormatter = new EventFormatter(this.options.namespace);

        this.subscribe();
    }

    /**
     * Subscribe to a Socket.io channel.
     */
    subscribe(): void {
        this.socket.emit('subscribe', {
            channel: this.name,
            auth: this.options.auth || {},
        });
    }

    /**
     * Unsubscribe from channel and ubind event callbacks.
     */
    unsubscribe(): void {
        this.unbind();

        this.socket.emit('unsubscribe', {
            channel: this.name,
            auth: this.options.auth || {},
        });
    }

    /**
     * Listen for an event on the channel instance.
     */
    listen(event: string, callback: Function): SocketIoChannel {
        this.on(this.eventFormatter.format(event), callback);

        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: Function): SocketIoChannel {
        this.unbindEvent(this.eventFormatter.format(event), callback);

        return this;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: Function): SocketIoChannel {
        this.on('connect', (socket) => {
            callback(socket);
        });

        return this;
    }

    /**
     * Register a callback to be called anytime an error occurs.
     */
    error(callback: Function): SocketIoChannel {
        return this;
    }

    /**
     * Bind the channel's socket to an event and store the callback.
     */
    on(event: string, callback: Function): SocketIoChannel {
        this.listeners[event] = this.listeners[event] || [];

        if (! this.events[event]) {
            this.events[event] = (channel, data) => {
                if (this.name === channel && this.listeners[event]) {
                    this.listeners[event].forEach((cb) => cb(data));
                }
            };

            this.socket.on(event, this.events[event]);
        }

        this.listeners[event].push(callback);

        return this;
    }

    /**
     * Unbind the channel's socket from all stored event callbacks.
     */
    unbind(): void {
        Object.keys(this.events).forEach((event) => {
            this.unbindEvent(event);
        });
    }

    /**
     * Unbind the listeners for the given event.
     */
    protected unbindEvent(event: string, callback?: Function): void {
        this.listeners[event] = this.listeners[event] || [];

        if (callback) {
            this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
        }

        if (!callback || this.listeners[event].length === 0) {
            if (this.events[event]) {
                this.socket.removeListener(event, this.events[event]);

                delete this.events[event];
            }

            delete this.listeners[event];
        }
    }
}
