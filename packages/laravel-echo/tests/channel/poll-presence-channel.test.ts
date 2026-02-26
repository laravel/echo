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
            members: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
            joined: [],
            left: [],
        });

        expect(cb).toHaveBeenCalledWith([
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
        ]);
    });

    test("joining() callbacks fire for each joined member", () => {
        const cb = vi.fn();
        channel.joining(cb);

        channel.updatePresence({
            members: [],
            joined: [{ id: 3, name: "Charlie" }, { id: 4, name: "Diana" }],
            left: [],
        });

        expect(cb).toHaveBeenCalledTimes(2);
        expect(cb).toHaveBeenCalledWith({ id: 3, name: "Charlie" });
        expect(cb).toHaveBeenCalledWith({ id: 4, name: "Diana" });
    });

    test("leaving() callbacks fire for each left member", () => {
        const cb = vi.fn();
        channel.leaving(cb);

        channel.updatePresence({
            members: [],
            joined: [],
            left: [{ id: 1, name: "Alice" }],
        });

        expect(cb).toHaveBeenCalledWith({ id: 1, name: "Alice" });
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

        channel.updatePresence({
            members: [{ id: 1 }],
            joined: [{ id: 2 }],
            left: [{ id: 3 }],
        });

        expect(here1).toHaveBeenCalledOnce();
        expect(here2).toHaveBeenCalledOnce();
        expect(joining1).toHaveBeenCalledOnce();
        expect(leaving1).toHaveBeenCalledOnce();
    });

    test("unsubscribe clears presence callbacks", () => {
        const here = vi.fn();
        const joining = vi.fn();
        const leaving = vi.fn();

        channel.here(here);
        channel.joining(joining);
        channel.leaving(leaving);

        channel.unsubscribe();

        channel.updatePresence({
            members: [{ id: 1 }],
            joined: [{ id: 2 }],
            left: [{ id: 3 }],
        });

        expect(here).not.toHaveBeenCalled();
        expect(joining).not.toHaveBeenCalled();
        expect(leaving).not.toHaveBeenCalled();
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
