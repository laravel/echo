import { MercureChannel } from "./mercure-channel";

/** A JWT-guarded Mercure channel with a publishable whisper topic. */
export class MercurePrivateChannel extends MercureChannel {
    /** Send a whisper to other channel members. */
    whisper(eventName: string, data: Record<any, any>): this {
        if (!this.whisperer) {
            throw new Error(
                `whisper("${eventName}"): this channel was constructed without a connector to publish through.`,
            );
        }

        this.whisperer.whisper(this.name, eventName, data);

        return this;
    }

    /** Skip the public warning and open the whisper stream on first use. */
    listenForWhisper(event: string, callback: CallableFunction): this {
        this.whisperer?.listenForWhispers(this.name);

        return this.listen(".client-" + event, callback);
    }
}
