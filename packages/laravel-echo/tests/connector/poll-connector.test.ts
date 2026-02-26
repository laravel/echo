import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from "vitest";
import { PollChannel, PollPresenceChannel } from "../../src/channel";
import { PollConnector } from "../../src/connector";

function mockFetchResponse(data: any): void {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(data),
        }),
    );
}

function mockFetchFailure(error?: Error): void {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(error ?? new Error("network error")),
    );
}

/**
 * Flush the initial poll's promise chain. The connector calls poll()
 * synchronously during connect(), but the fetch response resolves
 * as a microtask. Advancing by 0ms flushes it.
 */
async function flushInitialPoll(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
}

describe("PollConnector", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockFetchResponse({ events: [], lastEventId: "cursor-1" });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    function createConnector(overrides: Record<string, any> = {}) {
        return new PollConnector({
            broadcaster: "poll",
            pollInterval: 5000,
            withoutInterceptors: true,
            ...overrides,
        });
    }

    test("generates a socket ID on connect", () => {
        const connector = createConnector();
        const id = connector.socketId();

        expect(id).toBeDefined();
        expect(typeof id).toBe("string");
        expect(id!.length).toBeGreaterThan(0);
        expect(id).toContain(".");

        connector.disconnect();
    });

    test("creates public channels", () => {
        const connector = createConnector();
        const channel = connector.channel("orders");

        expect(channel).toBeInstanceOf(PollChannel);
        expect(channel.name).toBe("orders");

        // Same instance on subsequent calls
        expect(connector.channel("orders")).toBe(channel);

        connector.disconnect();
    });

    test("creates private channels with prefix", () => {
        const connector = createConnector();
        const channel = connector.privateChannel("orders");

        expect(channel).toBeInstanceOf(PollChannel);
        expect(channel.name).toBe("private-orders");

        expect(connector.privateChannel("orders")).toBe(channel);

        connector.disconnect();
    });

    test("creates presence channels with prefix", () => {
        const connector = createConnector();
        const channel = connector.presenceChannel("chat");

        expect(channel).toBeInstanceOf(PollPresenceChannel);
        expect(channel.name).toBe("presence-chat");

        expect(connector.presenceChannel("chat")).toBe(channel);

        connector.disconnect();
    });

    test("leave removes channel and its variants", () => {
        const connector = createConnector();
        connector.channel("orders");
        connector.privateChannel("orders");
        connector.presenceChannel("orders");

        expect(Object.keys(connector.channels)).toHaveLength(3);

        connector.leave("orders");

        expect(Object.keys(connector.channels)).toHaveLength(0);

        connector.disconnect();
    });

    test("leaveChannel removes a single channel", () => {
        const connector = createConnector();
        connector.channel("orders");
        connector.privateChannel("orders");

        connector.leaveChannel("orders");

        expect(connector.channels["orders"]).toBeUndefined();
        expect(connector.channels["private-orders"]).toBeDefined();

        connector.disconnect();
    });

    test("starts with connecting status", () => {
        const connector = createConnector();

        expect(connector.connectionStatus()).toBe("connecting");

        connector.disconnect();
    });

    test("transitions to connected after first successful poll", async () => {
        const connector = createConnector();

        await flushInitialPoll();

        expect(connector.connectionStatus()).toBe("connected");

        connector.disconnect();
    });

    test("fires connection status change callbacks", async () => {
        const connector = createConnector();
        const cb = vi.fn();
        connector.onConnectionChange(cb);

        await flushInitialPoll();

        expect(cb).toHaveBeenCalledWith("connected");

        connector.disconnect();
    });

    test("unsubscribe from connection status changes", async () => {
        const connector = createConnector();
        const cb = vi.fn();
        const unsub = connector.onConnectionChange(cb);

        unsub();

        await flushInitialPoll();

        expect(cb).not.toHaveBeenCalled();

        connector.disconnect();
    });

    test("disconnect stops polling and sets disconnected", async () => {
        const connector = createConnector();
        await flushInitialPoll();

        connector.disconnect();

        expect(connector.connectionStatus()).toBe("disconnected");
        expect(Object.keys(connector.channels)).toHaveLength(0);
    });

    test("polls the correct endpoint with channel names", async () => {
        const connector = createConnector();
        connector.channel("orders");
        connector.privateChannel("users");

        // Trigger an interval poll so the channels are included
        await vi.advanceTimersByTimeAsync(5000);

        const fetchMock = vi.mocked(fetch);
        const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
        const url = lastCall[0] as string;

        expect(url).toContain("/broadcasting/poll?");
        expect(url).toContain("channels%5B%5D=orders");
        expect(url).toContain("channels%5B%5D=private-users");

        connector.disconnect();
    });

    test("sends X-Socket-ID header", async () => {
        const connector = createConnector();

        await flushInitialPoll();

        const fetchMock = vi.mocked(fetch);
        const firstCall = fetchMock.mock.calls[0];
        const options = firstCall[1] as RequestInit;

        expect((options.headers as Record<string, string>)["X-Socket-ID"]).toBe(
            connector.socketId(),
        );

        connector.disconnect();
    });

    test("sends lastEventId after first poll", async () => {
        const connector = createConnector();
        connector.channel("orders");

        // First poll resolves with cursor-1
        await flushInitialPoll();

        // Trigger the next interval poll
        await vi.advanceTimersByTimeAsync(5000);

        const fetchMock = vi.mocked(fetch);
        const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
        const url = lastCall[0] as string;

        expect(url).toContain("lastEventId=cursor-1");

        connector.disconnect();
    });

    test("dispatches events to correct channels", async () => {
        mockFetchResponse({
            events: [
                {
                    id: "evt-1",
                    channel: "orders",
                    event: "OrderShipped",
                    data: { id: 42 },
                },
                {
                    id: "evt-2",
                    channel: "private-users",
                    event: "UserUpdated",
                    data: { name: "Alice" },
                },
            ],
            lastEventId: "evt-2",
        });

        const connector = createConnector();
        const ordersCb = vi.fn();
        const usersCb = vi.fn();

        connector.channel("orders").on("OrderShipped", ordersCb);
        connector.privateChannel("users").on("UserUpdated", usersCb);

        // Trigger an interval poll (channels are now registered)
        await vi.advanceTimersByTimeAsync(5000);

        expect(ordersCb).toHaveBeenCalledWith({ id: 42 });
        expect(usersCb).toHaveBeenCalledWith({ name: "Alice" });

        connector.disconnect();
    });

    test("dispatches presence data to presence channels", async () => {
        mockFetchResponse({
            events: [],
            lastEventId: "cursor-1",
            presence: {
                "presence-chat": {
                    members: [{ id: 1, name: "Alice" }],
                    joined: [{ id: 2, name: "Bob" }],
                    left: [],
                },
            },
        });

        const connector = createConnector();
        const hereCb = vi.fn();
        const joiningCb = vi.fn();

        connector.presenceChannel("chat").here(hereCb);
        connector.presenceChannel("chat").joining(joiningCb);

        // Trigger interval poll with presence data
        await vi.advanceTimersByTimeAsync(5000);

        expect(hereCb).toHaveBeenCalledWith([{ id: 1, name: "Alice" }]);
        expect(joiningCb).toHaveBeenCalledWith({ id: 2, name: "Bob" });

        connector.disconnect();
    });

    test("notifies subscribed callbacks on first successful poll", async () => {
        const connector = createConnector();
        const cb = vi.fn();

        connector.channel("orders").subscribed(cb);

        await flushInitialPoll();

        expect(cb).toHaveBeenCalledOnce();

        connector.disconnect();
    });

    test("transitions to reconnecting when poll fails after connected", async () => {
        const connector = createConnector();
        connector.channel("orders");

        // First poll succeeds
        await flushInitialPoll();
        expect(connector.connectionStatus()).toBe("connected");

        // Next poll fails
        mockFetchFailure();
        await vi.advanceTimersByTimeAsync(5000);

        expect(connector.connectionStatus()).toBe("reconnecting");

        connector.disconnect();
    });

    test("transitions to failed when poll fails before ever connecting", async () => {
        mockFetchFailure();

        const connector = createConnector();
        await flushInitialPoll();

        expect(connector.connectionStatus()).toBe("failed");

        connector.disconnect();
    });

    test("notifies error callbacks on poll failure", async () => {
        mockFetchFailure(new Error("network error"));

        const connector = createConnector();
        const cb = vi.fn();
        connector.channel("orders").error(cb);

        await flushInitialPoll();

        expect(cb).toHaveBeenCalledWith(expect.any(Error));

        connector.disconnect();
    });

    test("uses custom pollEndpoint", async () => {
        const connector = createConnector({
            pollEndpoint: "/api/custom-poll",
        });

        await flushInitialPoll();

        const fetchMock = vi.mocked(fetch);
        const url = fetchMock.mock.calls[0][0] as string;

        expect(url).toContain("/api/custom-poll?");

        connector.disconnect();
    });

    test("uses custom pollInterval", async () => {
        const connector = createConnector({ pollInterval: 2000 });
        connector.channel("orders");

        await flushInitialPoll();

        const fetchMock = vi.mocked(fetch);
        const callCount = fetchMock.mock.calls.length;

        // Advance by 2 seconds (custom interval)
        await vi.advanceTimersByTimeAsync(2000);

        expect(fetchMock.mock.calls.length).toBe(callCount + 1);

        connector.disconnect();
    });

    test("recovers to connected after reconnecting", async () => {
        const connector = createConnector();
        connector.channel("orders");

        // Connect successfully
        await flushInitialPoll();
        expect(connector.connectionStatus()).toBe("connected");

        // Fail
        mockFetchFailure();
        await vi.advanceTimersByTimeAsync(5000);
        expect(connector.connectionStatus()).toBe("reconnecting");

        // Recover
        mockFetchResponse({ events: [], lastEventId: "cursor-2" });
        await vi.advanceTimersByTimeAsync(5000);
        expect(connector.connectionStatus()).toBe("connected");

        connector.disconnect();
    });

    test("listen() convenience method works", async () => {
        mockFetchResponse({
            events: [
                {
                    id: "evt-1",
                    channel: "orders",
                    event: "OrderShipped",
                    data: { id: 1 },
                },
            ],
            lastEventId: "evt-1",
        });

        const connector = createConnector();
        const cb = vi.fn();

        connector.listen("orders", ".OrderShipped", cb);

        // Trigger interval poll
        await vi.advanceTimersByTimeAsync(5000);

        expect(cb).toHaveBeenCalledWith({ id: 1 });

        connector.disconnect();
    });

    test("prevents overlapping poll requests", async () => {
        // Make fetch hang (never resolve)
        vi.stubGlobal(
            "fetch",
            vi.fn().mockReturnValue(new Promise(() => {})),
        );

        const connector = createConnector();

        // Advance past several intervals while the first poll is still pending
        vi.advanceTimersByTime(15000);

        // fetch should only have been called once (the initial poll)
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

        connector.disconnect();
    });
});
