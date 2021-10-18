/**
 * This class represents a basic channel.
 */
export abstract class Channel {
    /**
     * The Echo options.
     */
    options: any;

    /**
     * Listen for an event on the channel instance.
     */
    abstract listen(event: string, callback: Function): Channel;

    /**
     * Listen for an event on the channel instance.
     */
    abstract listen(event: string, callback: Function): Channel;

    /**
     * Listen for an chunked event on the channel instance.
     */
    listenChunked(event: string, callback: Function, chunkPrefix = 'chunked'): Channel {
        this.listen(event, callback); // Allow normal un-chunked events.

        // Now the chunked variation. Allows arbitrarily long messages.
        let events = {};
        return this.listen(`${chunkPrefix}-${event}`, data => {
            if (!Object.prototype.hasOwnProperty.call(events, data.id)) {
                events[data.id] = { chunks: [], receivedFinal: false };
            }
            let ev = events[data.id];
            ev.chunks[data.index] = data.chunk;
            if (data.final) ev.receivedFinal = true;
            if (ev.receivedFinal && ev.chunks.length === Object.keys(ev.chunks).length) {
                callback(JSON.parse(ev.chunks.join("")));
                delete events[data.id];
            }
        });
    }

    /**
     * Listen for an event on the channel instance.
     */
    notification(callback: Function): Channel {
        return this.listen('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated', callback);
    }

    /**
     * Stop listening to an event on the channel instance.
     */
    abstract stopListening(event: string, callback?: Function): Channel;

    /**
     * Stop listening for a whisper event on the channel instance.
     */
    stopListeningForWhisper(event: string, callback?: Function): Channel {
        return this.stopListening('.client-' + event, callback);
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    abstract subscribed(callback: Function): Channel;

    /**
     * Register a callback to be called anytime an error occurs.
     */
    abstract error(callback: Function): Channel;
}
