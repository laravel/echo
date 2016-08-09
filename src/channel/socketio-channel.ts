import {EventFormatter} from './../util';
import {Connector} from './../connector';
import {Channel} from './channel';

/**
 * This class represents a Socket.io channel.
 */
export class SocketIoChannel extends Channel {

    /**
     * Channel object.
     *
     * @type {object}
     */
    channel: any;

    /**
     * Broadcasting connector.
     *
     * @type {Connector}
     */
    connector: Connector;

    /**
     * The event formatter.
     *
     * @type {EventFormatter}
     */
    eventFormatter: EventFormatter;

    /**
     * Create a new class instance.
     *
     * @param  {object}  channel
     * @param  {Connector}  connector
     */
    constructor(channel: any, connector: any) {
        super();

        this.channel = channel;
        this.connector = connector;
        this.eventFormatter = new EventFormatter;

        if (this.connector.options.namespace) {
            this.eventFormatter.namespace(this.connector.options.namespace);
        }
    }

    /**
     * Listen for an event on the channel instance.
     *
     * @param  {string} event
     * @param  {Function}   callback
     * @return {PusherChannel}
     */
    listen(event: string, callback: Function): PusherChannel {
        this.on(this.eventFormatter.format(event), callback);

        return this;
    }

    /**
     * Bind a channel to an event.
     *
     * @param  {string}   event
     * @param  {Function} callback
     */
    on(event: string, callback: Function) {
        this.channel.on(event, callback);
    }
}
