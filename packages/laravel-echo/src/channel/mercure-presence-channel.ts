import type { PresenceChannel } from "./presence-channel";
import { MercurePrivateChannel } from "./mercure-private-channel";

/** Presence synthesized from Mercure subscriptions with users deduplicated across connections. */
export class MercurePresenceChannel
    extends MercurePrivateChannel
    implements PresenceChannel
{
    /** Initial member-list callbacks. */
    private hereCallbacks: CallableFunction[] = [];

    /** Member joining callbacks. */
    private joiningCallbacks: CallableFunction[] = [];

    /** Member leaving callbacks. */
    private leavingCallbacks: CallableFunction[] = [];

    /** Members keyed by hub subscriber id. */
    private members: Map<string, NormalizedMember> = new Map();

    /** Live subscription counts keyed by member identity. */
    private memberCounts: Map<string, number> = new Map();

    /** Whether the initial member list has been seeded. */
    private seeded = false;

    /** Register an initial member-list callback. */
    here(callback: CallableFunction): this {
        this.hereCallbacks.push(callback);

        // Immediately notify callbacks registered after seeding...
        if (this.seeded) {
            this.invoke(callback, this.uniqueMembers());
        }

        return this;
    }

    /** Listen for members joining. */
    joining(callback: CallableFunction): this {
        this.joiningCallbacks.push(callback);

        return this;
    }

    /** Listen for members leaving. */
    leaving(callback: CallableFunction): this {
        this.leavingCallbacks.push(callback);

        return this;
    }

    /** Seed members from the subscription API snapshot. */
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

    /** Apply a live subscription event. */
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
            // Ignore leaves from unknown or unauthorized subscribers...
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

    /** Return one info entry per distinct member. */
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

    /** Isolate user callback failures from the connection refresh. */
    private invoke(callback: CallableFunction, argument: unknown): void {
        try {
            callback(argument);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`A "${this.name}" presence callback threw:`, error);
        }
    }
}

/** A deduplication key and its callback payload. */
type NormalizedMember = { key: string; info: unknown };

/** Use wrapped user_id identity and user_info payload, with payload identity for older servers. */
function normalizeMember(payload: unknown): NormalizedMember {
    if (
        payload !== null &&
        typeof payload === "object" &&
        "user_id" in payload &&
        typeof payload.user_id === "string"
    ) {
        const wrapped = payload as { user_id: string; user_info?: unknown };

        return { key: "user:" + wrapped.user_id, info: wrapped.user_info };
    }

    return {
        key: "payload:" + (JSON.stringify(payload) ?? "undefined"),
        info: payload,
    };
}
