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
     * Listen for a whisper event on the channel instance.
     */
    listenForWhisper(event: string, callback: Function): Channel {
        return this.listen('.client-' + event, callback);
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
    abstract stopListening(event: string): Channel;

    /**
     * Stop listening for a whispser event on the channel instance.
     */
    stopListeningForWhisper(event: string): Channel {
        return this.stopListening('.client-' + event);
    }
}
