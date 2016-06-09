
export class Connector {

    /**
     * Create a new class instance.
     */
    constructor(options) {
        this._options = {
            auth: {
                headers: {}
            },
            authEndpoint: '/broadcasting/auth',
            connector: 'pusher',
            csrfToken: null,
            host: 'http://localhost',
            pusherKey: null,
            namespace: null
        };
        this.setOptions(options);

        this.connect();
    }

    /**
     * Merge the custom options with the defaults.
     *
     * @param  {object}  options
     * @return {object}
     */
    setOptions(options) {
        this.options = Object.assign(this._options, options);

        if (this.csrfToken()) {
            this.options.auth.headers['X-CSRF-TOKEN'] = this.csrfToken();
        }

        return options;
    }

    /**
     * Extract the CSRF token from the page.
     */
    csrfToken() {
        let selector = document.querySelector('meta[name="csrf-token"]');

        if (this.options.csrfToken) {
            return this.options.csrfToken;
        } else if (selector) {
            return selector.getAttribute('content');
        }

        return null;
    }

    /**
     * Create a fresh connection.
     *
     * @retrn void
     */
    connect() {}

    /**
    * Subscribe to a channel.
    *
    * @param  {string} channel
    * @return {object}
    */
    subscribe(channel) {}

    /**
     * Unsubscribe from a channel.
     *
     * @param  {string} channel
     * @return {void}
     */
    unsubscribe(channel) {}

    /**
     * Get the socket_id of the connection.
     * 
     * @return {string}
     */
    socketId() {}
}
