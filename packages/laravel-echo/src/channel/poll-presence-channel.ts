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
     * Track known member IDs for client-side join/leave detection.
     *
     * The server returns only the current members list. Each client
     * diffs against its own known members to detect joins and leaves,
     * ensuring every client sees every change regardless of poll timing.
     */
    private knownMembers: Map<string | number, any> = new Map();

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
     *
     * The server returns only { members: [...] }. This method computes
     * joined/left by diffing against the client's own known members.
     */
    updatePresence(data: { members: any[] }): void {
        const currentMembers = data.members ?? [];
        const currentIds = new Set(
            currentMembers.map((m: any) => m.user_id),
        );

        // Detect newly joined members
        for (const member of currentMembers) {
            if (!this.knownMembers.has(member.user_id)) {
                this.joiningCallbacks.forEach((cb) => cb(member));
            }
        }

        // Detect members who left
        for (const [id, member] of this.knownMembers) {
            if (!currentIds.has(id)) {
                this.leavingCallbacks.forEach((cb) => cb(member));
            }
        }

        // Update known members
        this.knownMembers = new Map(
            currentMembers.map((m: any) => [m.user_id, m]),
        );

        // Fire here() with current member list
        this.hereCallbacks.forEach((cb) => cb(currentMembers));
    }

    /**
     * Unsubscribe from a channel.
     */
    unsubscribe(): void {
        super.unsubscribe();
        this.hereCallbacks.clear();
        this.joiningCallbacks.clear();
        this.leavingCallbacks.clear();
        this.knownMembers.clear();
    }
}
