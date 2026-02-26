import type { PresenceChannel } from "./presence-channel";
import { PollPrivateChannel } from "./poll-private-channel";

/**
 * This class represents a poll presence channel.
 */
export class PollPresenceChannel
    extends PollPrivateChannel
    implements PresenceChannel
{
    /**
     * Callbacks for the here event.
     */
    private hereCallbacks: Set<CallableFunction> = new Set();

    /**
     * Callbacks for the joining event.
     */
    private joiningCallbacks: Set<CallableFunction> = new Set();

    /**
     * Callbacks for the leaving event.
     */
    private leavingCallbacks: Set<CallableFunction> = new Set();

    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: CallableFunction): this {
        this.hereCallbacks.add(callback);
        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: CallableFunction): this {
        this.joiningCallbacks.add(callback);
        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: CallableFunction): this {
        this.leavingCallbacks.add(callback);
        return this;
    }

    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(_eventName: string, _data: Record<any, any>): this {
        return this;
    }

    /**
     * Update presence data from the poll response.
     */
    updatePresence(data: {
        members: any[];
        joined: any[];
        left: any[];
    }): void {
        if (data.members) {
            this.hereCallbacks.forEach((cb) => cb(data.members));
        }
        if (data.joined) {
            data.joined.forEach((member: any) => {
                this.joiningCallbacks.forEach((cb) => cb(member));
            });
        }
        if (data.left) {
            data.left.forEach((member: any) => {
                this.leavingCallbacks.forEach((cb) => cb(member));
            });
        }
    }

    /**
     * Unsubscribe from a channel.
     */
    unsubscribe(): void {
        super.unsubscribe();
        this.hereCallbacks.clear();
        this.joiningCallbacks.clear();
        this.leavingCallbacks.clear();
    }
}
