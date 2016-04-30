var PusherConnector = {
    /**
     * Create a fresh Pusher connection.
     */
    connect(pusherKey, customOptions = {}) {
        var csrfToken = PusherConnector.csrfToken();

        var pusher = new Pusher(
            pusherKey, PusherConnector.options(csrfToken, customOptions)
        );

        pusher.connection.bind('connected', () => {
            var request = new XMLHttpRequest();
            request.open('POST', '/broadcasting/socket', true);
            request.setRequestHeader('Content-Type', 'application/json');
            request.setRequestHeader('X-CSRF-Token', csrfToken);
            request.send(JSON.stringify({
                socket: pusher.connection.socket_id
            }));
        });

        return pusher;
    },


    /**
     * Merge the custom Pusher options with the defaults.
     */
    options(csrfToken, customOptions) {
        var options = {
            authEndpoint: '/broadcasting/auth',
            auth: {
                headers: { 'X-CSRF-Token': csrfToken }
            }
        };

        for (var attrname in customOptions) {
            options[attrname] = customOptions[attrname];
        }

        return options;
    },


    /**
     * Extract the CSRF token from the page.
     */
    csrfToken() {
        var selector = document.querySelector(
            'meta[name="csrf-token"]'
        );

        if ( ! selector) {
            console.error('Unable to locate CSRF token on page.')
        } else {
            return selector.getAttribute('content');
        }
    }
};


/**
 * This class represents a basic Pusher channel.
 */
function EchoChannel (channel) {
    this.channel = channel;

    /**
     * Listen for an event on the channel instance.
     */
    this.on = (event, callback) => {
        this.channel.bind(
            event.replace(/\./g, '\\'), callback
        );

        return this;
    };
}


/**
 * This class represents a Pusher presence channel.
 */
function EchoPresenceChannel (channel) {
    this.channel = channel;

    /**
     * Register a callback to be called on successfully joining the channel.
     */
    this.then = (callback) => {
        this.channel.bind('pusher:subscription_succeeded', (members) => {
            callback(members, this.channel);
        });

        return this;
    };


    /**
     * Listen for someone joining the channel.
     */
    this.joining = (callback) => {
        this.channel.bind('pusher:member_added', (member) => {
            callback(member, this.channel.members, this.channel);
        });

        return this;
    };


    /**
     * Listen for someone leaving the channel.
     */
    this.leaving = (callback) => {
        this.channel.bind('pusher:member_removed', (member) => {
            callback(member, this.channel.members, this.channel);
        });

        return this;
    };


    /**
     * Listen for an event on the channel instance.
     */
    this.on = (event, callback) => {
        this.channel.bind(event.replace(/\./g, '\\'), (data) => {
            callback(data, this.channel);
        });

        return this;
    };
}


/**
 * This class is the primary API for interacting with Pusher.
 */
function Echo (pusherKey, customOptions = {})
{
    this.channels = [];

    this.pusher = PusherConnector.connect(pusherKey, customOptions);

    /**
     * Listen for an event on a channel instance.
     */
    this.on = (channel, event, callback) => {
        return this.channel(channel).on(event, callback);
    };


    /**
     * Get a channel instance by name.
     */
    this.channel = (channel) => {
        return new EchoChannel(this.createChannel(channel));
    };


    /**
     * Get a presence channel instance by name.
     */
    this.join = (channel) => {
        return new EchoPresenceChannel(this.createChannel(channel));
    };


    /**
     * Create an subscribe to a fresh channel instance.
     */
    this.createChannel = (channel) => {
        if ( ! this.channels[channel]) {
            this.channels[channel] = this.pusher.subscribe(channel);
        }

        return this.channels[channel];
    };
}

module.exports = Echo;
