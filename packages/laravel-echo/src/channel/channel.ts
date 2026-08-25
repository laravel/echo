import type { EchoOptionsWithDefaults } from "../connector";
import type { BroadcastDriver } from "../echo";

/**
 * This class represents a basic channel.
 */
export abstract class Channel {
    /**
     * The Echo options.
     */
    options: EchoOptionsWithDefaults<BroadcastDriver>;

    /**
     * The name for Broadcast Notification Created events.
     */
    notificationCreatedEvent: string =
        ".Illuminate\\Notifications\\Events\\BroadcastNotificationCreated";

    /**
     * Listen for an event on the channel instance.
     */
    abstract listen(event: string, callback: CallableFunction): this;

    /**
     * Listen for a whisper event on the channel instance.
     */
    listenForWhisper(event: string, callback: CallableFunction): this {
        return this.listen(".client-" + event, callback);
    }

    /**
     * Listen for an event on the channel instance.
     */
    notification(callback: CallableFunction): this {
        return this.listen(this.notificationCreatedEvent, callback);
    }

    /**
     * Stop listening to an event on the channel instance.
     */
    abstract stopListening(event: string, callback?: CallableFunction): this;

    /**
     * Stop listening for notification events on the channel instance.
     */
    stopListeningForNotification(callback: CallableFunction): this {
        return this.stopListening(this.notificationCreatedEvent, callback);
    }

    /**
     * Stop listening for a whisper event on the channel instance.
     */
    stopListeningForWhisper(event: string, callback?: CallableFunction): this {
        return this.stopListening(".client-" + event, callback);
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     */
    abstract subscribed(callback: CallableFunction): this;

    /**
     * Register a callback to be called anytime an error occurs.
     */
    abstract error(callback: CallableFunction): this;
}
