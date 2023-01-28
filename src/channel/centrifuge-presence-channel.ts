import { PresenceChannel } from './presence-channel';
import { CentrifugeChannel } from './centrifuge-channel';

/**
 * This class represents a Centrifuge channel.
 */
export class CentrifugePresenceChannel extends CentrifugeChannel implements PresenceChannel {
    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: Function): CentrifugePresenceChannel {
        this.joining(callback);
        this.leaving(callback);

        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: Function): CentrifugePresenceChannel {
        this.on('join', (ctx) => callback(ctx.info));

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: Function): CentrifugePresenceChannel {
        this.on('leave', (ctx) => callback(ctx.info));

        return this;
    }
}
