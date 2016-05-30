import {EventFormatter} from './../util';

/**
 * This class represents a basic channel.
 */
export class Channel {

    /**
     * Channel object.
     * @type {object}
     */
    channel: any;

    /**
     * Broadcasting connector.
     * @type {any}
     */
    connector: any;

    /**
     * Create a new class instance.
     * @param  {object}  channel
     * @param  {Connector}  connector
     */
    constructor(channel: any, connector: any) {
        this.channel = channel;
        this.connector = connector;
    }

    /**
     * Bind a channel to an event.
     * @param  {string}   event    [description]
     * @param  {Function} callback [description]
     */
    bind(event: string, callback: Function) {
        let func = (typeof this.channel.bind === 'function') ? 'bind' : 'on';

        this.channel[func](event, callback);
    }

    /**
     * Listen for an event on the channel instance.
     * @param  {string} event
     * @param  {Function}   callback
     * @return {EchoChannel}
     */
    listen(event: string, callback: Function): Channel {
        this.bind(EventFormatter.format(event), callback);

        return this;
    }
}
