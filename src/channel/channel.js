import {EventFormatter} from './../util/event-formatter';

/**
 * This class represents a basic channel.
 */
export class Channel {

    /**
     * Create a new class instance.
     *
     * @param  {object}  channel
     * @param  {Connector}  connector
     */
    constructor(channel, connector) {
        this.channel = channel;
        this.connector = connector;
        this.eventFormatter = new EventFormatter;

        if (this.connector.options.namespace) {
            this.eventFormatter.namespace(this.connector.options.namespace);
        }
    }

    /**
     * Bind a channel to an event.
     *
     * @param  {string}   event
     * @param  {Function} callback
     */
    bind(event, callback) {
        let func = (typeof this.channel.bind === 'function') ? 'bind' : 'on';

        this.channel[func](event, callback);
    }

    /**
     * Listen for an event on the channel instance.
     * 
     * @param  {string} event
     * @param  {Function}   callback
     * @return {Channel}
     */
    listen(event, callback) {
        this.bind(this.eventFormatter.format(event), callback);

        return this;
    }
}
