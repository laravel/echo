import { describe, expect, test, vi } from "vitest";
import { MercureChannel } from "../../src/channel";
import { Connector } from "../../src/connector";

function makeChannel(namespace: string | false = false) {
    return new MercureChannel("some.channel", {
        broadcaster: "mercure",
        ...Connector._defaultOptions,
        namespace,
    });
}

describe("MercureChannel", () => {
    test("triggers all listeners for an event", () => {
        const channel = makeChannel();
        const l1 = vi.fn();
        const l2 = vi.fn();
        const l3 = vi.fn();

        channel.listen("MyEvent", l1);
        channel.listen("MyEvent", l2);
        channel.listen("MyOtherEvent", l3);

        channel.dispatch("MyEvent", { foo: "bar" });

        expect(l1).toHaveBeenCalledWith({ foo: "bar" });
        expect(l2).toHaveBeenCalledWith({ foo: "bar" });
        expect(l3).not.toHaveBeenCalled();
    });

    test("formats the event name using the configured namespace", () => {
        const channel = makeChannel("App.Events");
        const callback = vi.fn();

        channel.listen("MyEvent", callback);
        channel.dispatch("App\\Events\\MyEvent", { foo: "bar" });

        expect(callback).toHaveBeenCalledWith({ foo: "bar" });
    });

    test("a leading dot bypasses the namespace", () => {
        const channel = makeChannel("App.Events");
        const callback = vi.fn();

        channel.listen(".RawEvent", callback);
        channel.dispatch("RawEvent", { foo: "bar" });

        expect(callback).toHaveBeenCalledWith({ foo: "bar" });
    });

    test("can remove a specific listener for an event", () => {
        const channel = makeChannel();
        const l1 = vi.fn();
        const l2 = vi.fn();

        channel.listen("MyEvent", l1);
        channel.listen("MyEvent", l2);
        channel.stopListening("MyEvent", l1);

        channel.dispatch("MyEvent", {});

        expect(l1).not.toHaveBeenCalled();
        expect(l2).toHaveBeenCalled();
    });

    test("can remove all listeners for an event", () => {
        const channel = makeChannel();
        const l1 = vi.fn();
        const l2 = vi.fn();

        channel.listen("MyEvent", l1);
        channel.listen("MyEvent", l2);
        channel.stopListening("MyEvent");

        channel.dispatch("MyEvent", {});

        expect(l1).not.toHaveBeenCalled();
        expect(l2).not.toHaveBeenCalled();
    });

    test("whisper() throws: a public channel has no whisper topic", () => {
        expect(() => makeChannel().whisper("typing", {})).toThrow(
            "Public Mercure channels",
        );
    });

    test("listenForWhisper() warns that a public channel never receives whispers", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        try {
            const channel = makeChannel();
            const callback = vi.fn();

            channel.listenForWhisper("typing", callback);

            expect(warn).toHaveBeenCalled();

            // The listener remains registered despite the warning.
            channel.dispatch("client-typing", {});
            expect(callback).toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });

    test("notifies subscribed and error callbacks", () => {
        const channel = makeChannel();
        const subscribed = vi.fn();
        const error = vi.fn();

        channel.subscribed(subscribed);
        channel.error(error);

        channel.notifySubscribed();
        channel.notifyError("boom");

        expect(subscribed).toHaveBeenCalled();
        expect(error).toHaveBeenCalledWith("boom");
    });
});
