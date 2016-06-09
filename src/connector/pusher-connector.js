import {Connector} from './connector';

/**
 * This class creates a connector to Pusher.
 */
export class PusherConnector extends Connector {

    constructor(options) {
        super(options);
        
        this.pusher = {};
        /**
         * Name of event when members updated.
         *
         * @type {string}
         */
        this.updating = 'pusher:subscription_succeeded';
        /**
         * Name of event when member added.
         *
         * @type {string}
         */
        this.adding = 'pusher:member_added';
        /**
         * Name of event when member removed.
         *
         * @type {string}
         */
        this.removing = 'pusher:member_removed';
    }
    
    /**
     * Create a fresh Pusher connection.
     *
     * @return void
     */
    connect() {
        super.connect();
        
        let pusher = new Pusher(this.options.pusher_key, this.options);

        pusher.connection.bind('connected', () => {
            var request = new XMLHttpRequest();
            request.open('POST', '/broadcasting/socket', true);
            request.setRequestHeader('Content-Type', 'application/json');
            request.setRequestHeader('X-CSRF-Token', this.csrfToken());
            request.send(JSON.stringify({
                "socket_id": pusher.connection.socket_id
            }));
        });

        this.pusher = pusher;
    }

    /**
     * Subscribe to a channel.
     *
     * @param  {string} channel
     * @return {object}
     */
    subscribe(channel) {
        super.subscribe(channel);
        
        return this.pusher.subscribe(channel);
    }

    /**
     * Unsubscribe from a channel.
     *
     * @param  {string} channel
     * @return {void}
     */
    unsubscribe(channel) {
        super.unsubscribe(channel);
        
        this.pusher.unsubscribe(channel);
    }

    /**
     * Get the socket_id of the connection.
     *
     * @return {string}
     */
    socketId() {
        super.socketId();
        
        return this.pusher.connection.socket_id;
    }
}
