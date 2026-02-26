import { beforeEach, describe, expect, test, vi } from "vitest";
import { PollChannel } from "../../src/channel";
import { Connector } from "../../src/connector";

describe("PollChannel", () => {
    let channel: PollChannel;

    beforeEach(() => {
        channel = new PollChannel("some.channel", {
            broadcaster: "poll",
            ...Connector._defaultOptions,
            namespace: false,
        });
    });

    test("triggers all listeners for an event", () => {
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

        channel.dispatch("MyOtherEvent", { baz: 1 });

        expect(l3).toHaveBeenCalledWith({ baz: 1 });
    });

    test("can remove a specific listener for an event", () => {
        const l1 = vi.fn();
        const l2 = vi.fn();
        const l3 = vi.fn();
        channel.listen("MyEvent", l1);
        channel.listen("MyEvent", l2);
        channel.listen("MyOtherEvent", l3);

        channel.stopListening("MyEvent", l1);

        channel.dispatch("MyEvent", {});

        expect(l1).not.toHaveBeenCalled();
        expect(l2).toHaveBeenCalled();
        expect(l3).not.toHaveBeenCalled();

        channel.dispatch("MyOtherEvent", {});

        expect(l3).toHaveBeenCalled();
    });

    test("can remove all listeners for an event", () => {
        const l1 = vi.fn();
        const l2 = vi.fn();
        const l3 = vi.fn();
        channel.listen("MyEvent", l1);
        channel.listen("MyEvent", l2);
        channel.listen("MyOtherEvent", l3);

        channel.stopListening("MyEvent");

        channel.dispatch("MyEvent", {});

        expect(l1).not.toHaveBeenCalled();
        expect(l2).not.toHaveBeenCalled();
        expect(l3).not.toHaveBeenCalled();

        channel.dispatch("MyOtherEvent", {});

        expect(l3).toHaveBeenCalled();
    });

    test("formats event names with namespace", () => {
        const namespaced = new PollChannel("test", {
            broadcaster: "poll",
            ...Connector._defaultOptions,
            namespace: "App.Events",
        });

        const cb = vi.fn();
        namespaced.listen("OrderShipped", cb);

        // EventFormatter converts "App.Events.OrderShipped" to "App\\Events\\OrderShipped"
        namespaced.dispatch("App\\Events\\OrderShipped", { id: 1 });

        expect(cb).toHaveBeenCalledWith({ id: 1 });
    });

    test("formats dot-prefixed events without namespace", () => {
        const namespaced = new PollChannel("test", {
            broadcaster: "poll",
            ...Connector._defaultOptions,
            namespace: "App.Events",
        });

        const cb = vi.fn();
        namespaced.listen(".custom-event", cb);

        namespaced.dispatch("custom-event", { ok: true });

        expect(cb).toHaveBeenCalledWith({ ok: true });
    });

    test("notifySubscribed fires subscribed callbacks", () => {
        const cb1 = vi.fn();
        const cb2 = vi.fn();
        channel.subscribed(cb1);
        channel.subscribed(cb2);

        channel.notifySubscribed();

        expect(cb1).toHaveBeenCalledOnce();
        expect(cb2).toHaveBeenCalledOnce();
    });

    test("notifyError fires error callbacks", () => {
        const cb = vi.fn();
        channel.error(cb);

        const err = new Error("fail");
        channel.notifyError(err);

        expect(cb).toHaveBeenCalledWith(err);
    });

    test("unsubscribe clears all listeners and callbacks", () => {
        const listener = vi.fn();
        const subscribed = vi.fn();
        const error = vi.fn();

        channel.listen("MyEvent", listener);
        channel.subscribed(subscribed);
        channel.error(error);

        channel.unsubscribe();

        channel.dispatch("MyEvent", {});
        channel.notifySubscribed();
        channel.notifyError(new Error("fail"));

        expect(listener).not.toHaveBeenCalled();
        expect(subscribed).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });
});
