export abstract class Connector {

    /**
     * Default connector options.
     * @type {Object}
     */
    private _options: any = {
        auth: {
            headers: {}
        },
        authEndpoint: '/broadcasting/auth',
        connector: 'pusher',
        csrfToken: null,
        host: 'http://localhost',
        pusherKey: null
    };

    /**
     * Connector options.
     * @type {any}
     */
    options: any;

    /**
     * Create a new class instance.
     */
    constructor(options) {
        this.setOptions(options);

        this.connect();
    }

    /**
     * Merge the custom options with the defaults.
     * @param  {any}  options
     * @return {object}
     */
    protected setOptions(options: any) {
        this.options = Object.assign(this._options, options);

        if (this.csrfToken()) {
            this.options.auth.headers['X-CSRF-TOKEN'] = this.csrfToken();
        }

        return options;
    }

    /**
     * Extract the CSRF token from the page.
     */
    protected csrfToken() {
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
     * @retrn void
     */
    abstract connect(): void;

    /**
    * Subscribe to a channel.
    * @param  {string} channel
    * @return {object}
    */
    abstract subscribe(channel: string): any;

    /**
     * Unsubscribe from a channel.
     * @param  {string} channel
     * @return {void}
     */
    abstract unsubscribe(channel: string): void;

    /**
     * Get the socket_id of the connection.
     * @return {string}
     */
    abstract socketId(): string;
}
