/**
 * This class represents a basic channel.
 */
export abstract class Channel<T> {
    /**
     * The Echo options.
     */
    options: any;

    /**
     * Listen for an event on the channel instance.
     */
    abstract listen(event: string, callback: Function): T;

    /**
     * Listen for a whisper event on the channel instance.
     */
    listenForWhisper(event: string, callback: Function): T {
        return this.listen('.client-' + event, callback);
    }

    /**
     * Listen for an event on the channel instance.
     */
    notification(callback: Function): T {
        return this.listen('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated', callback);
    }

    /**
     * Stop listening to an event on the channel instance.
     */
    abstract stopListening(event: string, callback?: Function): T;

    /**
     * Stop listening for a whisper event on the channel instance.
     */
    stopListeningForWhisper(event: string, callback?: Function): T {
        return this.stopListening('.client-' + event, callback);
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    abstract subscribed(callback: Function): T;

    /**
     * Register a callback to be called anytime an error occurs.
     */
    abstract error(callback: Function): T;
}
