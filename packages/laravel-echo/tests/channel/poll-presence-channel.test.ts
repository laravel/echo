import { beforeEach, describe, expect, test, vi } from "vitest";
import { PollPresenceChannel } from "../../src/channel";
import { Connector } from "../../src/connector";

describe("PollPresenceChannel", () => {
    let channel: PollPresenceChannel;

    beforeEach(() => {
        channel = new PollPresenceChannel("presence-chat", {
            broadcaster: "poll",
            ...Connector._defaultOptions,
            namespace: false,
        });
    });

    test("here() callbacks fire with members list", () => {
        const cb = vi.fn();
        channel.here(cb);

        channel.updatePresence({
            members: [
                { user_id: 1, user_info: { name: "Alice" } },
                { user_id: 2, user_info: { name: "Bob" } },
            ],
        });

        expect(cb).toHaveBeenCalledWith([
            { user_id: 1, user_info: { name: "Alice" } },
            { user_id: 2, user_info: { name: "Bob" } },
        ]);
    });

    test("joining() callbacks fire for newly seen members", () => {
        const cb = vi.fn();
        channel.joining(cb);

        // First update — all members are "new"
        channel.updatePresence({
            members: [{ user_id: 1, user_info: {} }],
        });

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith({ user_id: 1, user_info: {} });

        cb.mockClear();

        // Second update — user 2 joins
        channel.updatePresence({
            members: [
                { user_id: 1, user_info: {} },
                { user_id: 2, user_info: {} },
            ],
        });

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith({ user_id: 2, user_info: {} });
    });

    test("leaving() callbacks fire when a member disappears", () => {
        const cb = vi.fn();
        channel.leaving(cb);

        // First update — establish known members
        channel.updatePresence({
            members: [
                { user_id: 1, user_info: { name: "Alice" } },
                { user_id: 2, user_info: { name: "Bob" } },
            ],
        });

        expect(cb).not.toHaveBeenCalled();

        // Second update — user 1 is gone
        channel.updatePresence({
            members: [{ user_id: 2, user_info: { name: "Bob" } }],
        });

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith({
            user_id: 1,
            user_info: { name: "Alice" },
        });
    });

    test("multiple callbacks can be registered for each event", () => {
        const here1 = vi.fn();
        const here2 = vi.fn();
        const joining1 = vi.fn();
        const leaving1 = vi.fn();

        channel.here(here1);
        channel.here(here2);
        channel.joining(joining1);
        channel.leaving(leaving1);

        // First update — user 1 joins
        channel.updatePresence({
            members: [{ user_id: 1, user_info: {} }],
        });

        expect(here1).toHaveBeenCalledOnce();
        expect(here2).toHaveBeenCalledOnce();
        expect(joining1).toHaveBeenCalledOnce();

        // Second update — user 1 leaves, user 2 joins
        channel.updatePresence({
            members: [{ user_id: 2, user_info: {} }],
        });

        expect(leaving1).toHaveBeenCalledOnce();
        expect(joining1).toHaveBeenCalledTimes(2);
    });

    test("unsubscribe clears presence callbacks and known members", () => {
        const here = vi.fn();
        const joining = vi.fn();
        const leaving = vi.fn();

        channel.here(here);
        channel.joining(joining);
        channel.leaving(leaving);

        channel.unsubscribe();

        channel.updatePresence({
            members: [{ user_id: 1, user_info: {} }],
        });

        expect(here).not.toHaveBeenCalled();
        expect(joining).not.toHaveBeenCalled();
        expect(leaving).not.toHaveBeenCalled();
    });

    test("same member in consecutive updates does not trigger joining again", () => {
        const joining = vi.fn();
        channel.joining(joining);

        channel.updatePresence({
            members: [{ user_id: 1, user_info: {} }],
        });

        joining.mockClear();

        channel.updatePresence({
            members: [{ user_id: 1, user_info: {} }],
        });

        expect(joining).not.toHaveBeenCalled();
    });

    test("every client sees leaving independently", () => {
        const leaving = vi.fn();
        channel.leaving(leaving);

        // Establish members
        channel.updatePresence({
            members: [
                { user_id: 1, user_info: {} },
                { user_id: 2, user_info: {} },
            ],
        });

        // User 2 disappears — this client sees leaving
        channel.updatePresence({
            members: [{ user_id: 1, user_info: {} }],
        });

        expect(leaving).toHaveBeenCalledTimes(1);
        expect(leaving).toHaveBeenCalledWith({ user_id: 2, user_info: {} });
    });

    test("whisper is a no-op", () => {
        const result = channel.whisper("typing", { user: 1 });
        expect(result).toBe(channel);
    });

    test("inherits event listening from PollChannel", () => {
        const cb = vi.fn();
        channel.listen("MessageSent", cb);

        channel.dispatch("MessageSent", { text: "hello" });

        expect(cb).toHaveBeenCalledWith({ text: "hello" });
    });
});
