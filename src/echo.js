/**
 * Default event namespace.
 */
var defaultNamespace = {
    value: 'App.Events'
};

class EchoEventFormatter {
    /**
     * Format the given event name.
     *
     * @param event
     * @returns {string}
     */
    static format(event)
    {
        if (event.charAt(0) != '\\') {
            event = defaultNamespace.value + '.' + event;
        } else {
            event = event.substr(1);
        }

        return event.replace(/\./g, '\\');
    }
}


class PusherConnector {
    /**
     * Create a fresh Pusher connection.
     *
     * @param pusherKey
     * @param csrfToken
     * @param customOptions
     * @returns {Pusher}
     */
    static connect(pusherKey, { csrfToken, ...customOptions } = {})
    {
        var csrfToken = csrfToken || PusherConnector.csrfToken();

        var pusher = new Pusher(
            pusherKey, PusherConnector.options(csrfToken, customOptions)
        );

        pusher.connection.bind('connected', () => {
            var request = new XMLHttpRequest();
            request.open('POST', '/broadcasting/socket', true);
            request.setRequestHeader('Content-Type', 'application/json');
            request.setRequestHeader('X-CSRF-Token', csrfToken);
            request.send(JSON.stringify({
                "socket_id": pusher.connection.socket_id
            }));
        });

        return pusher;
    }

    /**
     * Merge the custom Pusher options with the defaults.
     *
     * @param csrfToken
     * @param customOptions
     * @returns {*}
     */
    static options(csrfToken, customOptions)
    {
        var options = {
            authEndpoint: '/broadcasting/auth',
            auth: {
                headers: { 'X-CSRF-Token': csrfToken }
            }
        };

        return Object.assign(options, customOptions);
    }

    /**
     * Extract the CSRF token from the page.
     *
     * @returns {string}
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
     *
     * @param channel
     */
    constructor(channel)
    {
        this.channel = channel;
    }

    /**
     * Listen for an event on the channel instance.
     *
     * @param event
     * @param callback
     * @returns {EchoChannel}
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
     *
     * @param channel
     */
    constructor(channel)
    {
        this.channel = channel;
    }

    /**
     * Register a callback to be called anytime the member list changes.
     *
     * @param callback
     * @returns {EchoPresenceChannel}
     */
    here(callback)
    {
        this.then(callback);

        var addedOrRemovedCallback = (member) => {
            var members = Object.keys(this.channel.members.members).map(k => this.channel.members.members[k]);

            callback(members, this.channel);
        }

        this.channel.bind('pusher:member_added', addedOrRemovedCallback);
        this.channel.bind('pusher:member_removed', addedOrRemovedCallback);

        return this;
    }

    /**
     * Register a callback to be called on successfully joining the channel.
     *
     * @param callback
     * @returns {EchoPresenceChannel}
     */
    then(callback)
    {
        this.channel.bind('pusher:subscription_succeeded', (message) => {
            var members = Object.keys(message.members).map(k => message.members[k]);

            callback(members, this.channel);
        });

        return this;
    }

    /**
     * Listen for someone joining the channel.
     *
     * @param callback
     * @returns {EchoPresenceChannel}
     */
    joining(callback)
    {
        this.channel.bind('pusher:member_added', (member) => {
            var members = Object.keys(this.channel.members.members).map(k => this.channel.members.members[k]);

            callback(member.info, members, this.channel);
        });

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     *
     * @param callback
     * @returns {EchoPresenceChannel}
     */
    leaving(callback)
    {
        this.channel.bind('pusher:member_removed', (member) => {
            var members = Object.keys(this.channel.members.members).map(k => this.channel.members.members[k]);

            callback(member.info, members, this.channel);
        });

        return this;
    }

    /**
     * Listen for an event on the channel instance.
     *
     * @param event
     * @param callback
     * @returns {EchoPresenceChannel}
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
     *
     * @param pusherKey
     * @param customOptions
     */
    constructor(pusherKey, customOptions = {})
    {
        this.channels = [];

        this.pusher = PusherConnector.connect(pusherKey, customOptions);
    }

    /**
     * Listen for an event on a channel instance.
     *
     * @param channel
     * @param event
     * @param callback
     * @returns {EchoPresenceChannel|*|EchoChannel}
     */
    listen(channel, event, callback)
    {
        return this.channel(channel).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     *
     * @param channel
     * @returns {EchoChannel}
     */
    channel(channel)
    {
        return new EchoChannel(this.createChannel(channel));
    }

    /**
     * Get a private channel instance by name.
     *
     * @param channel
     * @returns {EchoChannel}
     */
    private(channel)
    {
        return this.channel('private-' + channel);
    }

    /**
     * Get a presence channel instance by name.
     *
     * @param channel
     * @returns {EchoPresenceChannel}
     */
    join(channel)
    {
        return new EchoPresenceChannel(this.createChannel('presence-' + channel));
    }

    /**
     * Create an subscribe to a fresh channel instance.
     *
     * @param channel
     * @returns {*}
     */
    createChannel(channel)
    {
        if ( ! this.channels[channel]) {
            this.channels[channel] = this.pusher.subscribe(channel);
        }

        return this.channels[channel];
    }

    /**
     * Leave the given channel.
     *
     * @param channel
     */
    leave(channel)
    {
        var channels = [channel, 'private-' + channel, 'presence-' + channel];

        channels.forEach(channelName => {
            if (this.channels[channelName]) {
                this.pusher.unsubscribe(channelName);

                this.channels.splice(channelName, 1);
            }
        });
    }

    /**
     * Get the Socket ID for the connection.
     *
     * @returns {*}
     */
    socketId()
    {
        return this.pusher.connection.socket_id;
    }

    /**
     * Set the default event namespace.
     *
     * @param value
     */
    namespace(value)
    {
        defaultNamespace.value = value;
    }
}

export default Echo;
