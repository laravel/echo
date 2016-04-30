/**
 * Default event namespace.
 */
var defaultNamespace = {
    value: 'App.Events'
};

class EchoEventFormatter {
    /**
     * Format the given event name.
     */
    static format(event)
    {
        if (event.charAt(0) != '\\') {
            event = defaultNamespace.value + '.' + event;
        }

        return event.replace(/\./g, '\\');
    }
}


class PusherConnector {
    /**
     * Create a fresh Pusher connection.
     */
    static connect(pusherKey, customOptions = {})
    {
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
    }

    /**
     * Merge the custom Pusher options with the defaults.
     */
    static options(csrfToken, customOptions)
    {
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
    }

    /**
     * Extract the CSRF token from the page.
     */
    static csrfToken() {
        var selector = document.querySelector(
            'meta[name="csrf-token"]'
        );

        if ( ! selector) {
            console.error('Unable to locate CSRF token on page.')
        } else {
            return selector.getAttribute('content');
        }
    }
}


/**
 * This class represents a basic Pusher channel.
 */
class EchoChannel {
    /**
     * Create a new class instance.
     */
    constructor(channel)
    {
        this.channel = channel;
    }

    /**
     * Listen for an event on the channel instance.
     */
    listen(event, callback)
    {
        this.channel.bind(EchoEventFormatter.format(event), callback);

        return this;
    }
}


/**
 * This class represents a Pusher presence channel.
 */
class EchoPresenceChannel {
    /**
     * Create a new class instance.
     */
    constructor(channel)
    {
        this.channel = channel;
    }

    /**
     * Register a callback to be called on successfully joining the channel.
     */
    then(callback)
    {
        this.channel.bind('pusher:subscription_succeeded', (members) => {
            callback(members, this.channel);
        });

        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback)
    {
        this.channel.bind('pusher:member_added', (member) => {
            callback(member, this.channel.members, this.channel);
        });

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback)
    {
        this.channel.bind('pusher:member_removed', (member) => {
            callback(member, this.channel.members, this.channel);
        });

        return this;
    }

    /**
     * Listen for an event on the channel instance.
     */
    listen(event, callback)
    {
        this.channel.bind(EchoEventFormatter.format(event), (data) => {
            callback(data, this.channel);
        });

        return this;
    }
}


/**
 * This class is the primary API for interacting with Pusher.
 */
class Echo {
    /**
     * Create a new class instance.
     */
    constructor(pusherKey, customOptions = {})
    {
        this.channels = [];

        this.pusher = PusherConnector.connect(pusherKey, customOptions);
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(channel, event, callback)
    {
        return this.channel(channel).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     */
    channel(channel)
    {
        return new EchoChannel(this.createChannel(channel));
    }

    /**
     * Get a private channel instance by name.
     */
    private(channel)
    {
        return this.channel('private-' + channel);
    }

    /**
     * Get a presence channel instance by name.
     */
    join(channel)
    {
        return new EchoPresenceChannel(this.createChannel('presence-' + channel));
    }

    /**
     * Create an subscribe to a fresh channel instance.
     */
    createChannel(channel)
    {
        if ( ! this.channels[channel]) {
            this.channels[channel] = this.pusher.subscribe(channel);
        }

        return this.channels[channel];
    }

    /**
     * Set the default event namespace.
     */
    namespace(value)
    {
        defaultNamespace.value = value;
    }
}

export default Echo;
