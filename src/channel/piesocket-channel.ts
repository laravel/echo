import { EventFormatter } from '../util';
import { Channel } from './channel';

/**
 * This class represents a PieSocket channel.
 */
export class PieSocketChannel extends Channel {
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
    constructor(piesocket: any, name: any, options: any) {
        super();

        this.name = name;
        this.piesocket = piesocket;
        this.options = options;
        this.eventFormatter = new EventFormatter(this.options.namespace);
        this.events = {};

        this.subscribe();
        this.on("message", this.handleMessages)
    }

    /**
     * Subscribe to a PieSocket channel.
     */
    subscribe(): any {
        this.subscription = this.piesocket.subscribe(this.name);
    }

    /**
     * Handle incoming messages
     */
    handleMessages(messageEvent): void {
        const payload = messageEvent.data;
        try{
            const message = JSON.parse(payload);
            const event = message.event;
            let data = message.data;
            try{
                data = JSON.parse(data);
            }catch(e){}

            if(event){
                //Fire event callbacks
                if(typeof this.events['*'] == "function"){
                    this.events['*'](this.getEventName(event), data);
                }


                if(typeof this.events[event] == "function"){
                    this.events[event](data);
                }
            }
        }catch(e){
            console.error(e);
        }
    }

    //Remove null values from payload
    getEventName(formattedEvent){
        const parts = formattedEvent.split("\\");
        return parts[parts.length-1];
    }


    /**
     * Unsubscribe from a PieSocket channel.
     */
    unsubscribe(): void {
        this.piesocket.unsubscribe(this.name);
    }

    /**
     * Listen for an event on the channel instance.
     */
    listen(event: string, callback: Function): PieSocketChannel {
        let eventName = event;
        if(!eventName.startsWith("system:")){
            eventName = this.eventFormatter.format(event);
        }
        this.events[eventName] = callback;

        return this;
    }

    /**
     * Listen for all events on the channel instance.
     */
    listenToAll(callback: Function): PieSocketChannel {
        this.events['*'] = callback;

        return this;
    }

    /**
     * Stop listening for an event on the channel instance.
     */
    stopListening(event: string, callback?: Function): PieSocketChannel {
        const eventName = this.eventFormatter.format(event);
        delete this.events[eventName];
        console.log("Listen", this.events);

        return this;
    }

    /**
     * Stop listening for all events on the channel instance.
     */
    stopListeningToAll(callback?: Function): PieSocketChannel {
        this.events = {};
        console.log("Listen", this.events);
        return this;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    subscribed(callback: Function): PieSocketChannel {
        this.on("open", ()=>{
            callback();
        });

        return this;
    }

    /**
     * Register a callback to be called anytime a subscription error occurs.
     */
    error(callback: Function): PieSocketChannel {
        this.on('error', (status) => {
            callback(status);
        });

        return this;
    }

    /**
     * Register a callback to be called anytime a subscription is closed.
     */
     closed(callback: Function): PieSocketChannel {
        this.on('close', (status) => {
            callback(status);
        });

        return this;
    }

    /**
     * Publish from client
     * C2C communication must be enable from PieSocket API settings
     */
    publish(eventName: string, data: any): PieSocketChannel {
        this.subscription.send(JSON.stringify({
            event: eventName,
            data: data
        }));

        return this;
    }

    /**
     * Bind a channel to an event.
     */
    on(event: string, callback: Function): PieSocketChannel {
        this.subscription.on(event, callback.bind(this));

        return this;
    }
}
