import { MercureChannel } from "./mercure-channel";

/**
 * This class represents a Mercure private channel.
 *
 * Mercure enforces the private/public distinction through the
 * subscriber's JWT scope, set server-side when the connection is
 * authorized. On top of the {@see MercureChannel} wire behavior, guarded
 * channels support whispers (client events), exchanged directly through
 * the hub on a per-channel whisper topic the subscriber may publish to.
 */
export class MercurePrivateChannel extends MercureChannel {
    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(eventName: string, data: Record<any, any>): this {
        if (!this.whisperer) {
            throw new Error(
                `whisper("${eventName}"): this channel was constructed without a connector to publish through.`,
            );
        }

        this.whisperer.whisper(this.name, eventName, data);

        return this;
    }

    /**
     * Listen for a whisper event on the channel instance.
     *
     * Reimplements the base Channel behavior instead of calling super, to
     * skip the public-channel warning MercureChannel adds on top of it.
     */
    listenForWhisper(event: string, callback: CallableFunction): this {
        return this.listen(".client-" + event, callback);
    }
}
