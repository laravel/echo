import { EventFormatter } from '../util';
import { Channel } from './channel';

/**
 * This class represents a Pusher channel.
 */
export class CentrifugeChannel extends Channel {
    /**
     * The Centrifuge client instance.
     */
    centrifuge: any;

    /**
     * The subscription instance
     */
    subscription: any;

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

    private getTokenCallback: any;

    /**
     * Create a new class instance.
     */
    constructor(centrifuge: any, name: string, options: any) {
        super();

        this.name = name;
        this.centrifuge = centrifuge;
        this.options = options;
        this.eventFormatter = new EventFormatter(this.options.namespace);

        this.getTokenCallback =
            options.getTokenCallback ||
            function (ctx) {
                return new Promise((resolve, reject) => {
                    axios
                        .get('/broadcasting/auth', { params: ctx })
                        .then((rsp) => {
                            resolve(rsp.data.token);
                        })
                        .catch((err) => {
                            reject(err);
                        });
                });
            };

        this.subscribe();
    }

    /**
     * Subscribe to a Centrifuge channel.
     */
    subscribe(): void {
        if (this.centrifuge.getSubscription(this.name) !== null) {
            return;
        }

        this.subscription = this.centrifuge.newSubscription(this.name, {
            getToken: (ctx) => this.getTokenCallback(ctx),
        });

        this.subscription.subscribe();

        this.subscription.on('publication', (ctx) => {
            if (ctx.data.event in this.events) {
                this.events[ctx.data.event](ctx.channel, ctx.data);
            }
        });
    }

    /**
     * Unsubscribe from channel and ubind event callbacks.
     */
    unsubscribe(): void {
        this.unbind();

        this.subscription.unsubscribe();
    }

    /**
     * Listen for an event on the channel instance.
     */
    listen(event: string, callback: Function): CentrifugeChannel {
        this.on(this.eventFormatter.format(event), callback);

        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: Function): CentrifugeChannel {
        this.unbindEvent(this.eventFormatter.format(event), callback);

        return this;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: Function): CentrifugeChannel {
        this.subscription.on('subscribed', (socket) => {
            callback(socket);
        });

        return this;
    }

    /**
     * Register a callback to be called anytime an error occurs.
     */
    error(callback: Function): CentrifugeChannel {
        this.subscription.on('error', (ctx) => callback(ctx));

        return this;
    }

    /**
     * Bind the channel's socket to an event and store the callback.
     */
    on(event: string, callback: Function): CentrifugeChannel {
        this.listeners[event] = this.listeners[event] || [];

        if (!this.events[event]) {
            this.events[event] = (channel, data) => {
                if (this.name === channel && this.listeners[event]) {
                    this.listeners[event].forEach((cb) => cb(data));
                }
            };
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
                delete this.events[event];
            }

            delete this.listeners[event];
        }
    }
}
