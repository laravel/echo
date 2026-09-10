import type { PresenceChannel } from "./presence-channel";
import { MercurePrivateChannel } from "./mercure-private-channel";

/**
 * This class represents a Mercure presence channel, built on top of the
 * Mercure hub's subscription API rather than a dedicated presence
 * primitive: every subscriber connect/disconnect is itself published as
 * an "active: true/false" update on a reserved topic, which the
 * connector subscribes to alongside the channel's own topic.
 *
 * Subscriptions are per-connection, so members are deduplicated on their
 * payload: one user in two tabs is one member, joining() fires on their
 * first connection and leaving() on their last. Because the connection is
 * shared across all joined channels, joining or leaving an unrelated
 * channel reopens it under a new subscriber id: other members see this
 * user leave and rejoin, which the dedupe cannot hide across connections.
 *
 * @see https://mercure.rocks/spec#active-subscriptions
 */
export class MercurePresenceChannel
    extends MercurePrivateChannel
    implements PresenceChannel
{
    /**
     * Callbacks to run once the initial member list is known.
     */
    private hereCallbacks: CallableFunction[] = [];

    /**
     * Callbacks to run whenever a new subscriber joins.
     */
    private joiningCallbacks: CallableFunction[] = [];

    /**
     * Callbacks to run whenever a subscriber leaves.
     */
    private leavingCallbacks: CallableFunction[] = [];

    /**
     * The currently known members, keyed by their hub-assigned (opaque,
     * per-connection) subscriber id.
     */
    private members: Map<string, NormalizedMember> = new Map();

    /**
     * How many live subscriptions each distinct member currently has,
     * keyed by the member's identity (see normalizeMember()).
     */
    private memberCounts: Map<string, number> = new Map();

    /**
     * Whether the initial member list has been seeded yet.
     */
    private seeded = false;

    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: CallableFunction): this {
        this.hereCallbacks.push(callback);

        // A late registration (after the snapshot already landed) still
        // deserves the current member list — it would otherwise never fire.
        if (this.seeded) {
            this.invoke(callback, this.uniqueMembers());
        }

        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: CallableFunction): this {
        this.joiningCallbacks.push(callback);

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: CallableFunction): this {
        this.leavingCallbacks.push(callback);

        return this;
    }

    /**
     * Seed the member list from the subscription API snapshot fetched
     * when the channel was joined.
     *
     * @internal called by the connector.
     */
    setInitialMembers(members: Array<[string, unknown]>): void {
        this.members = new Map(
            members.map(([subscriber, payload]) => [
                subscriber,
                normalizeMember(payload),
            ]),
        );
        this.memberCounts = new Map();

        for (const member of this.members.values()) {
            this.memberCounts.set(
                member.key,
                (this.memberCounts.get(member.key) ?? 0) + 1,
            );
        }

        this.seeded = true;

        this.hereCallbacks.forEach((callback) =>
            this.invoke(callback, this.uniqueMembers()),
        );
    }

    /**
     * Apply a live active:true/false subscription event for this channel.
     *
     * @internal called by the connector.
     */
    applySubscriptionEvent(
        subscriber: string,
        active: boolean,
        payload: unknown,
    ): void {
        if (active) {
            if (this.members.has(subscriber)) {
                return;
            }

            const member = normalizeMember(payload ?? {});
            const count = (this.memberCounts.get(member.key) ?? 0) + 1;

            this.members.set(subscriber, member);
            this.memberCounts.set(member.key, count);

            if (count === 1) {
                this.joiningCallbacks.forEach((callback) =>
                    this.invoke(callback, member.info),
                );
            }
        } else {
            // Ignore subscribers never seen joining: a replayed or
            // unauthorized subscription's leave event is not a member
            // leaving.
            const member = this.members.get(subscriber);

            if (!member) {
                return;
            }

            const count = (this.memberCounts.get(member.key) ?? 1) - 1;

            this.members.delete(subscriber);

            if (count <= 0) {
                this.memberCounts.delete(member.key);
                this.leavingCallbacks.forEach((callback) =>
                    this.invoke(callback, member.info),
                );
            } else {
                this.memberCounts.set(member.key, count);
            }
        }
    }

    /**
     * The current members' info, one entry per distinct member.
     */
    private uniqueMembers(): unknown[] {
        const seen = new Set<string>();
        const unique: unknown[] = [];

        for (const member of this.members.values()) {
            if (!seen.has(member.key)) {
                seen.add(member.key);
                unique.push(member.info);
            }
        }

        return unique;
    }

    /**
     * Run a user callback without letting an exception it throws take the
     * whole connection-refresh cycle (and the other callbacks) down with it.
     */
    private invoke(callback: CallableFunction, argument: unknown): void {
        try {
            callback(argument);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`A "${this.name}" presence callback threw:`, error);
        }
    }
}

/**
 * A member as tracked internally: the identity deduplicating one user's
 * multiple connections (tabs, devices), and the info exposed to here(),
 * joining(), and leaving() callbacks.
 */
type NormalizedMember = { key: string; info: unknown };

/**
 * Normalize a hub-delivered member payload.
 *
 * The server wraps the channel callback's result as {user_id, user_info}
 * (matching the other Echo drivers), so the identifier deduplicates even
 * when two users' callback results are identical, and callbacks receive
 * the info alone. A payload without that shape (an older server) falls
 * back to serialized-payload identity.
 */
function normalizeMember(payload: unknown): NormalizedMember {
    if (
        payload !== null &&
        typeof payload === "object" &&
        "user_id" in payload &&
        typeof (payload as { user_id: unknown }).user_id === "string"
    ) {
        const wrapped = payload as { user_id: string; user_info?: unknown };

        return { key: "user:" + wrapped.user_id, info: wrapped.user_info };
    }

    return {
        key: "payload:" + (JSON.stringify(payload) ?? "undefined"),
        info: payload,
    };
}
