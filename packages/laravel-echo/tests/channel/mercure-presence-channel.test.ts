import { describe, expect, test, vi } from "vitest";
import { MercurePresenceChannel } from "../../src/channel";
import { Connector } from "../../src/connector";

function makeChannel() {
    return new MercurePresenceChannel("presence-room.1", {
        broadcaster: "mercure",
        ...Connector._defaultOptions,
        namespace: false,
    });
}

describe("MercurePresenceChannel", () => {
    test("here() receives the seeded member list", () => {
        const channel = makeChannel();
        const here = vi.fn();

        channel.here(here);
        channel.setInitialMembers([
            ["urn:uuid:a", { name: "alice" }],
            ["urn:uuid:b", { name: "bob" }],
        ]);

        expect(here).toHaveBeenCalledWith([{ name: "alice" }, { name: "bob" }]);
    });

    test("joining() fires for a subscriber not already known", () => {
        const channel = makeChannel();
        const joining = vi.fn();

        channel.setInitialMembers([]);
        channel.joining(joining);
        channel.applySubscriptionEvent("urn:uuid:a", true, { name: "alice" });

        expect(joining).toHaveBeenCalledWith({ name: "alice" });
    });

    test("joining() does not re-fire for a subscriber already in the member list", () => {
        const channel = makeChannel();
        const joining = vi.fn();

        channel.setInitialMembers([["urn:uuid:a", { name: "alice" }]]);
        channel.joining(joining);
        channel.applySubscriptionEvent("urn:uuid:a", true, { name: "alice" });

        expect(joining).not.toHaveBeenCalled();
    });

    test("leaving() fires with the departing subscriber's payload", () => {
        const channel = makeChannel();
        const leaving = vi.fn();

        channel.setInitialMembers([["urn:uuid:a", { name: "alice" }]]);
        channel.leaving(leaving);
        channel.applySubscriptionEvent("urn:uuid:a", false, { name: "alice" });

        expect(leaving).toHaveBeenCalledWith({ name: "alice" });
    });

    test("a member can leave and rejoin", () => {
        const channel = makeChannel();
        const joining = vi.fn();
        const leaving = vi.fn();

        channel.setInitialMembers([["urn:uuid:a", { name: "alice" }]]);
        channel.joining(joining);
        channel.leaving(leaving);

        channel.applySubscriptionEvent("urn:uuid:a", false, { name: "alice" });
        channel.applySubscriptionEvent("urn:uuid:a", true, { name: "alice" });

        expect(leaving).toHaveBeenCalledTimes(1);
        expect(joining).toHaveBeenCalledTimes(1);
    });

    test("whisper() delegates to the connector like a private channel", () => {
        const whisperer = { whisper: vi.fn(), listenForWhispers: vi.fn() };
        const channel = new MercurePresenceChannel(
            "presence-room.1",
            {
                broadcaster: "mercure",
                ...Connector._defaultOptions,
                namespace: false,
            },
            whisperer,
        );

        expect(channel.whisper("typing", { name: "alice" })).toBe(channel);
        expect(whisperer.whisper).toHaveBeenCalledWith(
            "presence-room.1",
            "typing",
            { name: "alice" },
        );
    });

    test("whisper() throws when constructed without a connector", () => {
        const channel = makeChannel();

        expect(() => channel.whisper("typing", {})).toThrow();
    });

    test("here() registered after seeding fires immediately with the current members", () => {
        const channel = makeChannel();
        const here = vi.fn();

        channel.setInitialMembers([["urn:uuid:a", { name: "alice" }]]);
        channel.here(here);

        expect(here).toHaveBeenCalledWith([{ name: "alice" }]);
    });

    test("leaving() ignores subscribers never seen joining", () => {
        const channel = makeChannel();
        const leaving = vi.fn();

        channel.setInitialMembers([]);
        channel.leaving(leaving);
        channel.applySubscriptionEvent("urn:uuid:ghost", false, {
            name: "ghost",
        });

        expect(leaving).not.toHaveBeenCalled();
    });

    test("one user on several connections is one member", () => {
        const channel = makeChannel();
        const here = vi.fn();
        const joining = vi.fn();
        const leaving = vi.fn();

        channel.here(here);
        channel.joining(joining);
        channel.leaving(leaving);

        // Two tabs, same user payload.
        channel.setInitialMembers([
            ["urn:uuid:tab-a", { id: 7, name: "alice" }],
            ["urn:uuid:tab-b", { id: 7, name: "alice" }],
        ]);

        expect(here).toHaveBeenCalledWith([{ id: 7, name: "alice" }]);

        // A third connection joins: still the same member.
        channel.applySubscriptionEvent("urn:uuid:tab-c", true, {
            id: 7,
            name: "alice",
        });
        expect(joining).not.toHaveBeenCalled();

        // leaving() only fires once the last connection is gone.
        channel.applySubscriptionEvent("urn:uuid:tab-a", false, null);
        channel.applySubscriptionEvent("urn:uuid:tab-b", false, null);
        expect(leaving).not.toHaveBeenCalled();

        channel.applySubscriptionEvent("urn:uuid:tab-c", false, null);
        expect(leaving).toHaveBeenCalledWith({ id: 7, name: "alice" });
    });

    test("a throwing user callback does not break the other callbacks", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});

        const channel = makeChannel();
        const second = vi.fn();

        channel.here(() => {
            throw new Error("consumer bug");
        });
        channel.here(second);
        channel.setInitialMembers([]);

        expect(second).toHaveBeenCalledWith([]);
        expect(error).toHaveBeenCalled();

        error.mockRestore();
    });
});
