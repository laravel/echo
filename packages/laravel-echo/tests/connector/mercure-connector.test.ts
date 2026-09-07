import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MercurePresenceChannel } from "../../src/channel";
import { MercureConnector } from "../../src/connector";

class MockEventSource {
    static instances: MockEventSource[] = [];

    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;

    url: string;
    withCredentials: boolean;
    onopen: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    closed = false;
    readyState = MockEventSource.CONNECTING;

    private listeners: Record<string, Array<(event: MessageEvent) => void>> =
        {};

    constructor(url: string, options?: { withCredentials?: boolean }) {
        this.url = url;
        this.withCredentials = options?.withCredentials ?? false;
        MockEventSource.instances.push(this);
    }

    addEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
    ): void {
        (this.listeners[type] ??= []).push(listener);
    }

    close(): void {
        this.closed = true;
    }

    emitOpen(): void {
        this.readyState = MockEventSource.OPEN;
        this.onopen?.(new Event("open"));
    }

    emitError(): void {
        this.onerror?.(new Event("error"));
    }

    emitMessage(data: string, lastEventId = ""): void {
        this.onmessage?.({ data, lastEventId } as MessageEvent);
    }

    emitNamed(type: string, data: string, lastEventId = ""): void {
        const event = { data, lastEventId } as MessageEvent;
        (this.listeners[type] ?? []).forEach((listener) => listener(event));
    }

    static last(): MockEventSource {
        return MockEventSource.instances[MockEventSource.instances.length - 1];
    }
}

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status < 400,
        status,
        headers: { get: () => null },
        json: async () => body,
    };
}

function base64Url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function makeJwk(): JsonWebKey {
    return {
        kty: "oct",
        k: base64Url(crypto.getRandomValues(new Uint8Array(32))),
        alg: "A256GCM",
        use: "enc",
    };
}

/**
 * Build a compact JWE the way the server-side MercureChannelEncrypter
 * does: direct encryption under AES-256-GCM, the protected-header segment
 * as additional authenticated data.
 */
async function makeJwe(jwk: JsonWebKey, plaintext: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "AES-GCM" },
        false,
        ["encrypt"],
    );

    const header = base64Url(
        new TextEncoder().encode(
            JSON.stringify({ alg: "dir", enc: "A256GCM" }),
        ),
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const sealed = new Uint8Array(
        await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv,
                additionalData: new TextEncoder().encode(header),
                tagLength: 128,
            },
            key,
            new TextEncoder().encode(plaintext),
        ),
    );

    return [
        header,
        "",
        base64Url(iv),
        base64Url(sealed.slice(0, -16)),
        base64Url(sealed.slice(-16)),
    ].join(".");
}

describe("MercureConnector", () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    let connectors: MercureConnector[];

    beforeEach(() => {
        MockEventSource.instances = [];
        vi.stubGlobal("EventSource", MockEventSource);

        fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
        vi.stubGlobal("fetch", fetchMock);

        connectors = [];
    });

    afterEach(() => {
        // Stops reconnect/refresh timers, so no connector leaks an
        // EventSource into a later test.
        connectors.forEach((connector) => connector.disconnect());
        vi.unstubAllGlobals();
    });

    function makeConnector() {
        const connector = new MercureConnector({
            broadcaster: "mercure",
            host: "https://hub.example.com/.well-known/mercure",
            authEndpoint: "/broadcasting/auth",
            namespace: false,
        });

        connectors.push(connector);

        return connector;
    }

    test("a public channel still authenticates before opening the EventSource", async () => {
        const connector = makeConnector();

        connector.channel("news");

        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

        expect(fetchMock).toHaveBeenCalledWith(
            "/broadcasting/auth",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ channel_names: ["news"] }),
            }),
        );

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );

        const url = new URL(MockEventSource.instances[0].url);
        expect(url.searchParams.getAll("match")).toEqual(["news"]);
        expect(MockEventSource.instances[0].withCredentials).toBe(true);
    });

    test("a private channel authenticates before opening the EventSource", async () => {
        const connector = makeConnector();

        connector.privateChannel("room.1");

        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

        expect(fetchMock).toHaveBeenCalledWith(
            "/broadcasting/auth",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ channel_names: ["private-room.1"] }),
            }),
        );

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );

        const url = new URL(MockEventSource.instances[0].url);
        expect(url.searchParams.getAll("match")).toEqual(["private-room.1"]);
        expect(MockEventSource.instances[0].withCredentials).toBe(true);
    });

    test("a presence channel seeds from the subscription snapshot once the connection opens", async () => {
        fetchMock.mockImplementation((url: string) => {
            if (typeof url === "string" && url.includes("/subscriptions/")) {
                return Promise.resolve(
                    jsonResponse({
                        subscriptions: [
                            {
                                subscriber: "urn:uuid:a",
                                active: true,
                                payload: { name: "alice" },
                            },
                        ],
                    }),
                );
            }

            return Promise.resolve(jsonResponse({}));
        });

        const connector = makeConnector();
        const channel = connector.presenceChannel("room.2");
        const here = vi.fn();
        channel.here(here);

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );

        // The snapshot is only fetched after the EventSource opened, so it
        // includes this subscriber's own subscription.
        expect(here).not.toHaveBeenCalled();

        MockEventSource.instances[0].emitOpen();

        await vi.waitFor(() =>
            expect(here).toHaveBeenCalledWith([{ name: "alice" }]),
        );

        const url = new URL(MockEventSource.instances[0].url);
        expect(url.searchParams.getAll("match")).toEqual(["presence-room.2"]);
        expect(url.searchParams.getAll("match_urlpattern")).toEqual([
            "/.well-known/mercure/subscriptions/:match_type/presence-room.2/:subscriber",
        ]);
    });

    test("an incoming message dispatches only to the channels it targets", async () => {
        const connector = makeConnector();
        const news = connector.channel("news");
        const weather = connector.channel("weather");
        const newsCallback = vi.fn();
        const weatherCallback = vi.fn();

        news.listen("Tick", newsCallback);
        weather.listen("Tick", weatherCallback);

        await vi.waitFor(() =>
            expect(MockEventSource.instances.length).toBeGreaterThan(0),
        );

        MockEventSource.last().emitMessage(
            JSON.stringify({
                channels: ["news"],
                event: "Tick",
                payload: { time: "now" },
            }),
        );

        expect(newsCallback).toHaveBeenCalledWith({ time: "now" });
        expect(weatherCallback).not.toHaveBeenCalled();
    });

    test("a channel name resolving through the prototype chain is ignored", async () => {
        const connector = makeConnector();
        const news = connector.channel("news");
        const callback = vi.fn();
        news.listen("Tick", callback);

        await vi.waitFor(() =>
            expect(MockEventSource.instances.length).toBeGreaterThan(0),
        );

        MockEventSource.last().emitMessage(
            JSON.stringify({
                channels: ["__proto__", "news"],
                event: "Tick",
                payload: {},
            }),
        );

        expect(callback).toHaveBeenCalled();
    });

    test("an incoming message matching this connection's own socket id is ignored", async () => {
        const connector = makeConnector();
        const news = connector.channel("news");
        const callback = vi.fn();
        news.listen("Tick", callback);

        await vi.waitFor(() =>
            expect(MockEventSource.instances.length).toBeGreaterThan(0),
        );

        MockEventSource.last().emitMessage(
            JSON.stringify({
                channels: ["news"],
                event: "Tick",
                payload: {},
                socket: connector.socketId(),
            }),
        );

        expect(callback).not.toHaveBeenCalled();
    });

    test("a subscription event routes to the matching presence channel once seeded", async () => {
        const connector = makeConnector();
        const channel = connector.presenceChannel("room.3");
        const here = vi.fn();
        const joining = vi.fn();
        channel.here(here);
        channel.joining(joining);

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );

        MockEventSource.instances[0].emitOpen();
        await vi.waitFor(() => expect(here).toHaveBeenCalled());

        MockEventSource.instances[0].emitNamed(
            "mercure",
            JSON.stringify({
                match: "presence-room.3",
                match_type: "exact",
                subscriber: "urn:uuid:b",
                active: true,
                payload: { name: "bob" },
            }),
        );

        expect(joining).toHaveBeenCalledWith({ name: "bob" });
    });

    test("a subscription event without a member payload is a phantom and is ignored", async () => {
        const connector = makeConnector();
        const channel = connector.presenceChannel("room.3");
        const here = vi.fn();
        const joining = vi.fn();
        channel.here(here);
        channel.joining(joining);

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );

        MockEventSource.instances[0].emitOpen();
        await vi.waitFor(() => expect(here).toHaveBeenCalled());

        // An unauthorized subscriber merely requesting the topic gets a
        // subscription event too, but never a server-attached payload.
        MockEventSource.instances[0].emitNamed(
            "mercure",
            JSON.stringify({
                match: "presence-room.3",
                match_type: "exact",
                subscriber: "urn:uuid:phantom",
                active: true,
            }),
        );

        // A urlpattern subscription whose pattern equals the channel name
        // is not an exact member either.
        MockEventSource.instances[0].emitNamed(
            "mercure",
            JSON.stringify({
                match: "presence-room.3",
                match_type: "urlpattern",
                subscriber: "urn:uuid:c",
                active: true,
                payload: { name: "carol" },
            }),
        );

        expect(joining).not.toHaveBeenCalled();
    });

    test("subscription events arriving before the snapshot are buffered and replayed after seeding", async () => {
        let resolveSnapshot!: (value: unknown) => void;

        fetchMock.mockImplementation((url: string) => {
            if (typeof url === "string" && url.includes("/subscriptions/")) {
                return new Promise((resolve) => {
                    resolveSnapshot = resolve;
                });
            }

            return Promise.resolve(jsonResponse({}));
        });

        const connector = makeConnector();
        const channel = connector.presenceChannel("room.4");
        const here = vi.fn();
        const joining = vi.fn();
        channel.here(here);
        channel.joining(joining);

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );

        MockEventSource.instances[0].emitOpen();
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

        // Arrives while the snapshot is still in flight.
        MockEventSource.instances[0].emitNamed(
            "mercure",
            JSON.stringify({
                match: "presence-room.4",
                match_type: "exact",
                subscriber: "urn:uuid:b",
                active: true,
                payload: { name: "bob" },
            }),
        );

        expect(joining).not.toHaveBeenCalled();

        resolveSnapshot(
            jsonResponse({
                subscriptions: [
                    {
                        subscriber: "urn:uuid:self",
                        active: true,
                        payload: { name: "me" },
                    },
                ],
            }),
        );

        await vi.waitFor(() =>
            expect(here).toHaveBeenCalledWith([{ name: "me" }]),
        );
        await vi.waitFor(() =>
            expect(joining).toHaveBeenCalledWith({ name: "bob" }),
        );
    });

    test("leaving the last channel closes the connection", async () => {
        const connector = makeConnector();
        connector.channel("news");

        await vi.waitFor(() =>
            expect(MockEventSource.instances.length).toBeGreaterThan(0),
        );

        connector.leaveChannel("news");

        await vi.waitFor(() =>
            expect(connector.connectionStatus()).toBe("disconnected"),
        );
        expect(
            MockEventSource.instances.every((instance) => instance.closed),
        ).toBe(true);
    });

    test("joining several channels in the same tick costs one auth request and one connection", async () => {
        const connector = makeConnector();

        connector.channel("news");
        connector.privateChannel("room.1");
        connector.presenceChannel("lobby");

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(
            fetchMock.mock.calls.filter(
                ([url]) => url === "/broadcasting/auth",
            ),
        ).toHaveLength(1);
        expect(MockEventSource.instances).toHaveLength(1);

        const url = new URL(MockEventSource.instances[0].url);
        expect(url.searchParams.getAll("match")).toEqual([
            "news",
            "private-room.1",
            "presence-lobby",
        ]);
    });

    test("disconnect() during an in-flight refresh prevents the connection from reopening", async () => {
        let resolveAuth!: (value: unknown) => void;
        fetchMock.mockImplementation((url: string) => {
            if (url === "/broadcasting/auth") {
                return new Promise((resolve) => {
                    resolveAuth = resolve;
                });
            }

            return Promise.resolve(jsonResponse({}));
        });

        const connector = makeConnector();
        connector.channel("news");

        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

        connector.disconnect();
        resolveAuth(jsonResponse({}));

        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(MockEventSource.instances).toHaveLength(0);
        expect(connector.connectionStatus()).toBe("disconnected");
    });

    test("a denied initial auth surfaces on the channel's error callbacks and evicts it", async () => {
        fetchMock.mockResolvedValue(jsonResponse({}, 419));

        const connector = makeConnector();
        const error = vi.fn();
        connector.channel("news").error(error);

        await vi.waitFor(() => expect(error).toHaveBeenCalled());

        expect(String(error.mock.calls[0][0])).toContain("419");

        // The denied channel is evicted, so the connector winds down
        // instead of retrying a batch the server already rejected.
        await vi.waitFor(() =>
            expect(connector.connectionStatus()).toBe("disconnected"),
        );
    });

    test("a denied join evicts only the new channel and keeps the working set alive", async () => {
        fetchMock.mockImplementation((url: string, init?: RequestInit) => {
            if (url === "/broadcasting/auth") {
                const body = JSON.parse(String(init?.body)) as {
                    channel_names: string[];
                };

                if (body.channel_names.includes("private-secret")) {
                    return Promise.resolve(jsonResponse({}, 403));
                }

                return Promise.resolve(jsonResponse({}));
            }

            return Promise.resolve(jsonResponse({}));
        });

        const connector = makeConnector();
        const survivorError = vi.fn();
        connector.channel("news").error(survivorError);

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );

        const error = vi.fn();
        connector.privateChannel("secret").error(error);

        // Exactly one error, the eviction-specific one.
        await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(1));
        expect(String(error.mock.calls[0][0])).toContain("private-secret");

        // The trailing refresh re-authenticates the surviving set and
        // reopens the connection for it.
        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(2),
        );

        const url = new URL(MockEventSource.instances[1].url);
        expect(url.searchParams.getAll("match")).toEqual(["news"]);

        // The surviving channel recovered transparently: no false alarm.
        expect(survivorError).not.toHaveBeenCalled();
    });

    test("a transient auth failure keeps the current connection and schedules a retry", async () => {
        const connector = makeConnector();
        connector.channel("news");

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );

        fetchMock.mockResolvedValue(jsonResponse({}, 500));

        const error = vi.fn();
        connector.channel("weather").error(error);

        await vi.waitFor(() => expect(error).toHaveBeenCalled());

        // No eviction, no teardown: the previous EventSource keeps serving
        // the already-working channel while the retry backs off.
        expect(connector.connectionStatus()).toBe("reconnecting");
        expect(MockEventSource.instances).toHaveLength(1);
        expect(MockEventSource.instances[0].closed).toBe(false);
        expect(Object.keys(connector.channels)).toContain("weather");
    });

    test("joining more channels than the server's batch cap evicts the overflow with a clear error", async () => {
        const connector = makeConnector();

        for (let i = 1; i <= 100; i++) {
            connector.channel(`channel.${i}`);
        }

        const error = vi.fn();
        connector.channel("channel.101").error(error);

        await vi.waitFor(() => expect(error).toHaveBeenCalled());
        expect(String(error.mock.calls[0][0])).toContain("at most 100");

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );

        const body = JSON.parse(
            String(
                fetchMock.mock.calls.find(
                    ([url]) => url === "/broadcasting/auth",
                )?.[1]?.body,
            ),
        ) as { channel_names: string[] };

        expect(body.channel_names).toHaveLength(100);
    });

    test("a failed presence snapshot surfaces on error() and is retried on the next refresh", async () => {
        let failSnapshot = true;
        fetchMock.mockImplementation((url: string) => {
            if (typeof url === "string" && url.includes("/subscriptions/")) {
                if (failSnapshot) {
                    return Promise.resolve(jsonResponse({}, 403));
                }

                return Promise.resolve(jsonResponse({ subscriptions: [] }));
            }

            return Promise.resolve(jsonResponse({}));
        });

        const connector = makeConnector();
        const channel = connector.presenceChannel("room.9");
        const here = vi.fn();
        const error = vi.fn();
        channel.here(here);
        channel.error(error);

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );
        MockEventSource.instances[0].emitOpen();

        await vi.waitFor(() => expect(error).toHaveBeenCalled());
        expect(here).not.toHaveBeenCalled();

        failSnapshot = false;
        connector.channel("news");

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(2),
        );
        MockEventSource.instances[1].emitOpen();

        await vi.waitFor(() => expect(here).toHaveBeenCalledWith([]));
    });

    test("subscribed() fires once per channel, not on every unrelated topology change", async () => {
        const connector = makeConnector();
        const subscribedA = vi.fn();
        const subscribedB = vi.fn();

        connector.channel("a").subscribed(subscribedA);

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );
        MockEventSource.instances[0].emitOpen();
        expect(subscribedA).toHaveBeenCalledTimes(1);

        connector.channel("b").subscribed(subscribedB);

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(2),
        );
        MockEventSource.instances[1].emitOpen();

        expect(subscribedB).toHaveBeenCalledTimes(1);
        expect(subscribedA).toHaveBeenCalledTimes(1);
    });

    test("subscribed() fires again after the connection was actually lost", async () => {
        const connector = makeConnector();
        const subscribed = vi.fn();

        connector.channel("a").subscribed(subscribed);

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );
        MockEventSource.instances[0].emitOpen();
        expect(subscribed).toHaveBeenCalledTimes(1);

        vi.useFakeTimers();

        try {
            const first = MockEventSource.instances[0];
            first.readyState = MockEventSource.CLOSED;
            first.emitError();

            await vi.advanceTimersByTimeAsync(1000);
            expect(MockEventSource.instances).toHaveLength(2);
        } finally {
            vi.useRealTimers();
        }

        MockEventSource.instances[1].emitOpen();
        expect(subscribed).toHaveBeenCalledTimes(2);
    });

    test("the cookie is proactively re-minted before the reported expires_in elapses", async () => {
        fetchMock.mockImplementation((url: string) => {
            if (url === "/broadcasting/auth") {
                return Promise.resolve(
                    jsonResponse({
                        channel_names: [{ name: "news" }],
                        expires_in: 300,
                    }),
                );
            }

            return Promise.resolve(jsonResponse({}));
        });

        const authCalls = () =>
            fetchMock.mock.calls.filter(([url]) => url === "/broadcasting/auth")
                .length;

        vi.useFakeTimers();

        try {
            const connector = makeConnector();
            connector.channel("news");

            await vi.advanceTimersByTimeAsync(0);
            expect(MockEventSource.instances).toHaveLength(1);
            expect(authCalls()).toBe(1);

            // 80% of the 300s TTL.
            await vi.advanceTimersByTimeAsync(240_000);
            expect(authCalls()).toBe(2);

            // The refresh re-arms itself.
            await vi.advanceTimersByTimeAsync(240_000);
            expect(authCalls()).toBe(3);

            // The cookie is refreshed under the running connection: no
            // teardown, no new EventSource.
            expect(MockEventSource.instances).toHaveLength(1);
        } finally {
            vi.useRealTimers();
        }
    });

    test("a permanently closed EventSource re-authenticates and reopens after a delay", async () => {
        const connector = makeConnector();
        connector.channel("news");

        await vi.waitFor(() =>
            expect(MockEventSource.instances).toHaveLength(1),
        );

        vi.useFakeTimers();

        try {
            const first = MockEventSource.instances[0];
            first.readyState = MockEventSource.CLOSED;
            first.emitError();

            expect(connector.connectionStatus()).toBe("reconnecting");
            expect(MockEventSource.instances).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(1000);

            expect(MockEventSource.instances).toHaveLength(2);
        } finally {
            vi.useRealTimers();
        }
    });

    test("connection status transitions are reported to listeners", async () => {
        const connector = makeConnector();
        const statuses: string[] = [];
        connector.onConnectionChange((status) => statuses.push(status));

        connector.channel("news");

        await vi.waitFor(() =>
            expect(MockEventSource.instances.length).toBeGreaterThan(0),
        );
        MockEventSource.last().emitOpen();

        expect(statuses).toContain("connecting");
        expect(statuses).toContain("connected");
    });

    test("a custom EventSource implementation can be injected via options", async () => {
        class CustomEventSource extends MockEventSource {
            static customInstances: CustomEventSource[] = [];

            constructor(url: string, options?: { withCredentials?: boolean }) {
                super(url, options);
                CustomEventSource.customInstances.push(this);
            }
        }

        const connector = new MercureConnector({
            broadcaster: "mercure",
            host: "https://hub.example.com/.well-known/mercure",
            authEndpoint: "/broadcasting/auth",
            namespace: false,
            eventSource: CustomEventSource as unknown as typeof EventSource,
        });

        connectors.push(connector);

        connector.channel("news");

        await vi.waitFor(() =>
            expect(CustomEventSource.customInstances).toHaveLength(1),
        );
    });

    describe("end-to-end encrypted channels", () => {
        const CHANNEL = "private-encrypted-orders.1";

        function makeEncryptedSetup(jwk: JsonWebKey) {
            fetchMock.mockImplementation((url: string) => {
                if (url === "/broadcasting/auth") {
                    return Promise.resolve(
                        jsonResponse({
                            channel_names: [{ name: CHANNEL, jwk }],
                            expires_in: 300,
                        }),
                    );
                }

                return Promise.resolve(jsonResponse({}));
            });

            const connector = makeConnector();
            const channel = connector.encryptedPrivateChannel("orders.1");

            return { connector, channel };
        }

        test("an encrypted update is decrypted with the auth-provided JWK and dispatched", async () => {
            const jwk = makeJwk();
            const { channel } = makeEncryptedSetup(jwk);
            const callback = vi.fn();
            channel.listen("OrderShipped", callback);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(1),
            );

            const jwe = await makeJwe(
                jwk,
                JSON.stringify({
                    event: "OrderShipped",
                    payload: { order: { id: 1 } },
                }),
            );

            MockEventSource.instances[0].emitMessage(
                JSON.stringify({ channels: [CHANNEL], data: jwe }),
            );

            await vi.waitFor(() =>
                expect(callback).toHaveBeenCalledWith({ order: { id: 1 } }),
            );
        });

        test("an encrypted update from this connection's own socket is ignored", async () => {
            const jwk = makeJwk();
            const { connector, channel } = makeEncryptedSetup(jwk);
            const callback = vi.fn();
            const error = vi.fn();
            channel.listen("OrderShipped", callback);
            channel.error(error);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(1),
            );

            const jwe = await makeJwe(
                jwk,
                JSON.stringify({
                    event: "OrderShipped",
                    payload: {},
                    socket: connector.socketId(),
                }),
            );

            MockEventSource.instances[0].emitMessage(
                JSON.stringify({ channels: [CHANNEL], data: jwe }),
            );

            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(callback).not.toHaveBeenCalled();
            expect(error).not.toHaveBeenCalled();
        });

        test("a plaintext update targeting an encrypted channel is never dispatched", async () => {
            const { channel } = makeEncryptedSetup(makeJwk());
            const callback = vi.fn();
            channel.listen("OrderShipped", callback);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(1),
            );

            // A compromised hub injecting a plaintext broadcast envelope
            // must not reach listeners on an encrypted channel.
            MockEventSource.instances[0].emitMessage(
                JSON.stringify({
                    channels: [CHANNEL],
                    event: "OrderShipped",
                    payload: { forged: true },
                }),
            );

            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(callback).not.toHaveBeenCalled();
        });

        test("an update that fails to decrypt surfaces on error() and is not dispatched", async () => {
            const { channel } = makeEncryptedSetup(makeJwk());
            const callback = vi.fn();
            const error = vi.fn();
            channel.listen("OrderShipped", callback);
            channel.error(error);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(1),
            );

            // Encrypted under a different key: the GCM tag check fails.
            const jwe = await makeJwe(
                makeJwk(),
                JSON.stringify({ event: "OrderShipped", payload: {} }),
            );

            MockEventSource.instances[0].emitMessage(
                JSON.stringify({ channels: [CHANNEL], data: jwe }),
            );

            await vi.waitFor(() => expect(error).toHaveBeenCalled());
            expect(callback).not.toHaveBeenCalled();
        });

        test("a malformed JWE surfaces on error() and is not dispatched", async () => {
            const { channel } = makeEncryptedSetup(makeJwk());
            const callback = vi.fn();
            const error = vi.fn();
            channel.listen("OrderShipped", callback);
            channel.error(error);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(1),
            );

            MockEventSource.instances[0].emitMessage(
                JSON.stringify({ channels: [CHANNEL], data: "not.a.jwe" }),
            );

            await vi.waitFor(() => expect(error).toHaveBeenCalled());
            expect(callback).not.toHaveBeenCalled();
        });

        test("an encrypted update on a channel with no known key surfaces on error()", async () => {
            fetchMock.mockResolvedValue(
                jsonResponse({
                    channel_names: [{ name: CHANNEL }],
                    expires_in: 300,
                }),
            );

            const connector = makeConnector();
            const channel = connector.encryptedPrivateChannel("orders.1");
            const error = vi.fn();
            channel.error(error);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(1),
            );

            const jwe = await makeJwe(
                makeJwk(),
                JSON.stringify({ event: "OrderShipped", payload: {} }),
            );

            MockEventSource.instances[0].emitMessage(
                JSON.stringify({ channels: [CHANNEL], data: jwe }),
            );

            await vi.waitFor(() => expect(error).toHaveBeenCalled());
            expect(String(error.mock.calls[0][0])).toContain("encryption_key");
        });
    });

    describe("topic namespacing", () => {
        const PREFIX = "https://laravel.alt/echo/";

        function mockNamespacedAuth() {
            fetchMock.mockImplementation((url: string) => {
                if (url === "/broadcasting/auth") {
                    return Promise.resolve(
                        jsonResponse({
                            expires_in: 300,
                            topic_prefix: PREFIX,
                            client_events: true,
                        }),
                    );
                }

                return Promise.resolve(jsonResponse({}));
            });
        }

        test("the EventSource matches the server-reported channel topics", async () => {
            mockNamespacedAuth();

            const connector = makeConnector();
            connector.channel("news");
            connector.privateChannel("room.1");

            await vi.waitFor(() =>
                expect(MockEventSource.instances.length).toBeGreaterThan(0),
            );

            const url = new URL(MockEventSource.instances[0].url);
            expect(url.searchParams.getAll("match")).toEqual([
                `${PREFIX}channel/news`,
                `${PREFIX}channel/private-room.1`,
            ]);
        });

        test("channel names are encoded into a single topic path segment", async () => {
            mockNamespacedAuth();

            const connector = makeConnector();
            connector.privateChannel("room/1 !'()*");

            await vi.waitFor(() =>
                expect(MockEventSource.instances.length).toBeGreaterThan(0),
            );

            const url = new URL(MockEventSource.instances[0].url);
            // Byte-identical to PHP's rawurlencode(), the derivation the
            // server-minted grants rely on.
            expect(url.searchParams.getAll("match")).toContain(
                `${PREFIX}channel/private-room%2F1%20%21%27%28%29%2A`,
            );
        });

        test("presence patterns, snapshots, and subscription events use the channel topic", async () => {
            const snapshots: string[] = [];

            fetchMock.mockImplementation((url: string) => {
                if (url === "/broadcasting/auth") {
                    return Promise.resolve(
                        jsonResponse({
                            expires_in: 300,
                            topic_prefix: PREFIX,
                            client_events: true,
                        }),
                    );
                }

                if (
                    typeof url === "string" &&
                    url.includes("/subscriptions/")
                ) {
                    snapshots.push(url);

                    return Promise.resolve(jsonResponse({ subscriptions: [] }));
                }

                return Promise.resolve(jsonResponse({}));
            });

            const connector = makeConnector();
            const channel = connector.presenceChannel("room.2");
            const here = vi.fn();
            const joining = vi.fn();
            channel.here(here);
            channel.joining(joining);

            await vi.waitFor(() =>
                expect(MockEventSource.instances.length).toBeGreaterThan(0),
            );

            const encodedTopic =
                "https%3A%2F%2Flaravel.alt%2Fecho%2Fchannel%2Fpresence-room.2";
            const url = new URL(MockEventSource.instances[0].url);

            expect(url.searchParams.getAll("match_urlpattern")).toEqual([
                `/.well-known/mercure/subscriptions/:match_type/${encodedTopic}/:subscriber`,
            ]);

            MockEventSource.instances[0].emitOpen();
            await vi.waitFor(() => expect(here).toHaveBeenCalled());

            expect(snapshots[0]).toBe(
                `https://hub.example.com/.well-known/mercure/subscriptions/exact/${encodedTopic}`,
            );

            // The hub reports subscription events on the topic, not the
            // channel name: they must map back.
            MockEventSource.instances[0].emitNamed(
                "mercure",
                JSON.stringify({
                    match: `${PREFIX}channel/presence-room.2`,
                    match_type: "exact",
                    subscriber: "urn:uuid:b",
                    active: true,
                    payload: { name: "bob" },
                }),
            );

            expect(joining).toHaveBeenCalledWith({ name: "bob" });
        });
    });

    describe("whispers", () => {
        const PREFIX = "https://laravel.alt/echo/";
        const HUB = "https://hub.example.com/.well-known/mercure";

        function mockWhisperAuth(
            options: {
                clientEvents?: boolean;
                channels?: unknown[];
                publishStatuses?: number[];
            } = {},
        ) {
            const publishStatuses = options.publishStatuses ?? [];

            fetchMock.mockImplementation((url: string) => {
                if (url === "/broadcasting/auth") {
                    return Promise.resolve(
                        jsonResponse({
                            expires_in: 300,
                            topic_prefix: PREFIX,
                            client_events: options.clientEvents ?? true,
                            channel_names: options.channels ?? [],
                        }),
                    );
                }

                if (url === HUB) {
                    return Promise.resolve(
                        jsonResponse({}, publishStatuses.shift() ?? 200),
                    );
                }

                return Promise.resolve(jsonResponse({}));
            });
        }

        function whisperEventSource(name?: string): MockEventSource {
            if (name === undefined) {
                return MockEventSource.last();
            }

            const source = MockEventSource.instances.find(
                (instance) =>
                    !instance.closed &&
                    new URL(instance.url).searchParams
                        .getAll("match")
                        .includes(`${PREFIX}whisper/${name}`),
            );

            if (!source) {
                throw new Error(`No whisper stream for ${name}.`);
            }

            return source;
        }

        function hubPublishCalls() {
            return fetchMock.mock.calls.filter(([url]) => url === HUB);
        }

        async function decryptJwe(
            jwk: JsonWebKey,
            serialized: string,
        ): Promise<string> {
            const key = await crypto.subtle.importKey(
                "jwk",
                jwk,
                { name: "AES-GCM" },
                false,
                ["decrypt"],
            );

            const [header, , iv, ciphertext, tag] = serialized
                .split(".")
                .map((segment, index) =>
                    index === 0
                        ? segment
                        : Uint8Array.from(
                              atob(
                                  segment
                                      .replace(/-/g, "+")
                                      .replace(/_/g, "/") +
                                      "=".repeat(
                                          (4 - (segment.length % 4)) % 4,
                                      ),
                              ),
                              (character) => character.charCodeAt(0),
                          ),
                ) as [
                string,
                unknown,
                Uint8Array<ArrayBuffer>,
                Uint8Array<ArrayBuffer>,
                Uint8Array<ArrayBuffer>,
            ];

            const sealed = new Uint8Array(ciphertext.length + tag.length);
            sealed.set(ciphertext);
            sealed.set(tag, ciphertext.length);

            return new TextDecoder().decode(
                await crypto.subtle.decrypt(
                    {
                        name: "AES-GCM",
                        iv,
                        additionalData: new TextEncoder().encode(header),
                        tagLength: 128,
                    },
                    key,
                    sealed,
                ),
            );
        }

        test("one exact-topic whisper EventSource opens per guarded channel", async () => {
            mockWhisperAuth();

            const connector = makeConnector();
            connector.channel("news");
            connector.privateChannel("room.1");
            connector.presenceChannel("lobby");

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(3),
            );

            for (const name of ["private-room.1", "presence-lobby"]) {
                const source = whisperEventSource(name);
                const url = new URL(source.url);
                expect(url.searchParams.getAll("match")).toEqual([
                    `${PREFIX}whisper/${name}`,
                ]);
                expect(url.searchParams.has("match_urlpattern")).toBe(false);
                expect(source.withCredentials).toBe(true);
            }
        });

        describe("channel isolation", () => {
            function envelope(name: string): string {
                return JSON.stringify({
                    channels: [name],
                    event: "client-typing",
                    payload: { name: "alice" },
                });
            }

            test.each(["private", "presence", "public"])(
                "a whisper cannot target another joined %s channel",
                async (kind) => {
                    mockWhisperAuth();
                    const connector = makeConnector();
                    const sender = connector.privateChannel("room.1");
                    const target =
                        kind === "private"
                            ? connector.privateChannel("room.2")
                            : kind === "presence"
                              ? connector.presenceChannel("room.2")
                              : connector.channel("news");
                    const callback = vi.fn();
                    target.listen(".client-typing", callback);
                    const senderCallback = vi.fn();
                    sender.listenForWhisper("typing", senderCallback);

                    const stream = await vi.waitFor(() =>
                        whisperEventSource("private-room.1"),
                    );
                    stream.emitMessage(envelope(target.name));

                    expect(callback).not.toHaveBeenCalled();
                    expect(senderCallback).not.toHaveBeenCalled();

                    stream.emitMessage(envelope(sender.name));
                    expect(senderCallback).toHaveBeenCalledWith({
                        name: "alice",
                    });
                },
            );

            test("a mismatched encrypted envelope is rejected before key import", async () => {
                const name = "private-encrypted-orders.1";
                const jwk = makeJwk();
                mockWhisperAuth({ channels: [{ name, jwk }] });
                const connector = makeConnector();
                connector.privateChannel("room.1");
                connector.encryptedPrivateChannel("orders.1");
                const stream = await vi.waitFor(() =>
                    whisperEventSource("private-room.1"),
                );
                const data = await makeJwe(jwk, envelope(name));
                const importKey = vi.spyOn(crypto.subtle, "importKey");

                try {
                    stream.emitMessage(
                        JSON.stringify({ channels: [name], data }),
                    );
                    await Promise.resolve();
                    await Promise.resolve();

                    expect(importKey).not.toHaveBeenCalled();
                } finally {
                    importKey.mockRestore();
                }
            });

            test("each whisper stream retains only its own replay cursor", async () => {
                mockWhisperAuth();
                const connector = makeConnector();
                connector.privateChannel("room.1");
                connector.privateChannel("room.2");
                const first = await vi.waitFor(() =>
                    whisperEventSource("private-room.1"),
                );
                const second = whisperEventSource("private-room.2");

                first.emitMessage(envelope("private-room.1"), "first-10");
                second.emitMessage(envelope("private-room.2"), "second-20");
                connector.channel("news");

                await vi.waitFor(() => expect(first.closed).toBe(true));
                expect(second.closed).toBe(true);
                expect(
                    new URL(
                        whisperEventSource("private-room.1").url,
                    ).searchParams.get("last_event_id"),
                ).toBe("first-10");
                expect(
                    new URL(
                        whisperEventSource("private-room.2").url,
                    ).searchParams.get("last_event_id"),
                ).toBe("second-20");
            });

            test("leaving a channel immediately closes its stream and forgets its cursor", async () => {
                mockWhisperAuth();
                const connector = makeConnector();
                connector.privateChannel("room.1");
                connector.privateChannel("room.2");
                const previous = await vi.waitFor(() =>
                    whisperEventSource("private-room.1"),
                );
                previous.emitMessage(envelope("private-room.1"), "old-10");

                connector.leaveChannel("private-room.1");
                expect(previous.closed).toBe(true);

                const callback = vi.fn();
                connector
                    .privateChannel("room.1")
                    .listenForWhisper("typing", callback);
                const current = await vi.waitFor(() =>
                    whisperEventSource("private-room.1"),
                );

                expect(
                    new URL(current.url).searchParams.has("last_event_id"),
                ).toBe(false);
                previous.emitMessage(envelope("private-room.1"), "stale-20");
                expect(callback).not.toHaveBeenCalled();
                current.emitMessage(envelope("private-room.1"));
                expect(callback).toHaveBeenCalledTimes(1);
            });

            test("replaced whisper streams cannot dispatch or schedule reconnects", async () => {
                mockWhisperAuth();
                const connector = makeConnector();
                const callback = vi.fn();
                connector
                    .privateChannel("room.1")
                    .listenForWhisper("typing", callback);
                const previous = await vi.waitFor(() =>
                    whisperEventSource("private-room.1"),
                );
                connector.channel("news");
                await vi.waitFor(() => expect(previous.closed).toBe(true));
                const count = MockEventSource.instances.length;

                vi.useFakeTimers();
                try {
                    previous.emitMessage(envelope("private-room.1"));
                    previous.readyState = MockEventSource.CLOSED;
                    previous.emitError();
                    await vi.advanceTimersByTimeAsync(1000);

                    expect(callback).not.toHaveBeenCalled();
                    expect(MockEventSource.instances).toHaveLength(count);
                } finally {
                    vi.useRealTimers();
                }
            });

            test("terminal whisper failures share one reauthentication cycle", async () => {
                mockWhisperAuth();
                const connector = makeConnector();
                connector.privateChannel("room.1");
                connector.privateChannel("room.2");
                const first = await vi.waitFor(() =>
                    whisperEventSource("private-room.1"),
                );
                const second = whisperEventSource("private-room.2");

                vi.useFakeTimers();
                try {
                    first.readyState = MockEventSource.CLOSED;
                    second.readyState = MockEventSource.CLOSED;
                    first.emitError();
                    second.emitError();
                    await vi.advanceTimersByTimeAsync(1000);

                    expect(
                        fetchMock.mock.calls.filter(
                            ([url]) => url === "/broadcasting/auth",
                        ),
                    ).toHaveLength(2);
                    expect(
                        MockEventSource.instances.filter(
                            (source) => !source.closed,
                        ),
                    ).toHaveLength(3);
                    expect(whisperEventSource("private-room.1")).not.toBe(
                        first,
                    );
                    expect(whisperEventSource("private-room.2")).not.toBe(
                        second,
                    );
                } finally {
                    vi.useRealTimers();
                }
            });

            test("disabling client events closes every whisper stream", async () => {
                mockWhisperAuth();
                const connector = makeConnector();
                connector.privateChannel("room.1");
                connector.privateChannel("room.2");
                const first = await vi.waitFor(() =>
                    whisperEventSource("private-room.1"),
                );
                const second = whisperEventSource("private-room.2");

                mockWhisperAuth({ clientEvents: false });
                connector.channel("news");
                await vi.waitFor(() => expect(first.closed).toBe(true));

                expect(second.closed).toBe(true);
                expect(
                    MockEventSource.instances.filter(
                        (source) => !source.closed,
                    ),
                ).toHaveLength(1);
            });

            test("disconnect closes every whisper stream", async () => {
                mockWhisperAuth();
                const connector = makeConnector();
                connector.privateChannel("room.1");
                connector.privateChannel("room.2");
                await vi.waitFor(() => whisperEventSource("private-room.1"));

                connector.disconnect();

                expect(
                    MockEventSource.instances.every((source) => source.closed),
                ).toBe(true);
            });
        });

        test("no whisper EventSource opens for public-only channels", async () => {
            mockWhisperAuth();

            const connector = makeConnector();
            connector.channel("news");

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(1),
            );
            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(MockEventSource.instances).toHaveLength(1);
        });

        test("no whisper EventSource opens when the server does not grant client events", async () => {
            mockWhisperAuth({ clientEvents: false });

            const connector = makeConnector();
            connector.privateChannel("room.1");

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(1),
            );
            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(MockEventSource.instances).toHaveLength(1);
        });

        test("whisper() publishes the update on the channel's whisper topic", async () => {
            mockWhisperAuth();

            const connector = makeConnector();
            const channel = connector.privateChannel("room.1");

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            channel.whisper("typing", { name: "alice" });

            await vi.waitFor(() => expect(hubPublishCalls()).toHaveLength(1));

            const [, init] = hubPublishCalls()[0] as [string, RequestInit];
            const body = init.body as URLSearchParams;

            expect(init.credentials).toBe("include");
            expect(body.get("topic")).toBe(`${PREFIX}whisper/private-room.1`);
            expect(body.get("private")).toBe("on");
            expect(JSON.parse(body.get("data")!)).toEqual({
                channels: ["private-room.1"],
                event: "client-typing",
                payload: { name: "alice" },
                socket: connector.socketId(),
            });
        });

        test("an incoming whisper dispatches to listenForWhisper()", async () => {
            mockWhisperAuth();

            const connector = makeConnector();
            const channel = connector.privateChannel("room.1");
            const callback = vi.fn();
            channel.listenForWhisper("typing", callback);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            whisperEventSource().emitMessage(
                JSON.stringify({
                    channels: ["private-room.1"],
                    event: "client-typing",
                    payload: { name: "bob" },
                    socket: "someone-else",
                }),
            );

            expect(callback).toHaveBeenCalledWith({ name: "bob" });
        });

        test("a whisper from this connection's own socket never echoes back", async () => {
            mockWhisperAuth();

            const connector = makeConnector();
            const channel = connector.privateChannel("room.1");
            const callback = vi.fn();
            channel.listenForWhisper("typing", callback);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            whisperEventSource().emitMessage(
                JSON.stringify({
                    channels: ["private-room.1"],
                    event: "client-typing",
                    payload: {},
                    socket: connector.socketId(),
                }),
            );

            expect(callback).not.toHaveBeenCalled();
        });

        test("a forged non-client event on the whisper path is dropped", async () => {
            mockWhisperAuth();

            const connector = makeConnector();
            const channel = connector.privateChannel("room.1");
            const callback = vi.fn();
            channel.listen("OrderShipped", callback);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            whisperEventSource().emitMessage(
                JSON.stringify({
                    channels: ["private-room.1"],
                    event: "OrderShipped",
                    payload: { forged: true },
                }),
            );

            expect(callback).not.toHaveBeenCalled();
        });

        test("a whisper naming several channels, or an unjoined one, is dropped", async () => {
            mockWhisperAuth();

            const connector = makeConnector();
            const channel = connector.privateChannel("room.1");
            const callback = vi.fn();
            channel.listenForWhisper("typing", callback);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            whisperEventSource().emitMessage(
                JSON.stringify({
                    channels: ["private-room.1", "private-room.2"],
                    event: "client-typing",
                    payload: {},
                }),
            );
            whisperEventSource().emitMessage(
                JSON.stringify({
                    channels: ["private-other"],
                    event: "client-typing",
                    payload: {},
                }),
            );

            expect(callback).not.toHaveBeenCalled();
        });

        test("a plaintext whisper targeting an encrypted channel is dropped", async () => {
            mockWhisperAuth({
                channels: [
                    { name: "private-encrypted-orders.1", jwk: makeJwk() },
                ],
            });

            const connector = makeConnector();
            const channel = connector.encryptedPrivateChannel("orders.1");
            const callback = vi.fn();
            channel.listenForWhisper("typing", callback);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            whisperEventSource().emitMessage(
                JSON.stringify({
                    channels: ["private-encrypted-orders.1"],
                    event: "client-typing",
                    payload: { forged: true },
                }),
            );

            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(callback).not.toHaveBeenCalled();
        });

        test("a whisper on an encrypted channel is sealed under the channel key", async () => {
            const jwk = makeJwk();
            mockWhisperAuth({
                channels: [{ name: "private-encrypted-orders.1", jwk }],
            });

            const connector = makeConnector();
            const channel = connector.encryptedPrivateChannel("orders.1");

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            channel.whisper("typing", { name: "alice" });

            await vi.waitFor(() => expect(hubPublishCalls()).toHaveLength(1));

            const [, init] = hubPublishCalls()[0] as [string, RequestInit];
            const body = init.body as URLSearchParams;
            const envelope = JSON.parse(body.get("data")!) as {
                channels: string[];
                data: string;
            };

            expect(body.get("topic")).toBe(
                `${PREFIX}whisper/private-encrypted-orders.1`,
            );
            expect(envelope.channels).toEqual(["private-encrypted-orders.1"]);

            // Byte-compatible with the server-published JWE format.
            expect(JSON.parse(await decryptJwe(jwk, envelope.data))).toEqual({
                event: "client-typing",
                payload: { name: "alice" },
                socket: connector.socketId(),
            });
        });

        test("an incoming encrypted whisper decrypts and dispatches; a non-client one is dropped", async () => {
            const jwk = makeJwk();
            mockWhisperAuth({
                channels: [{ name: "private-encrypted-orders.1", jwk }],
            });

            const connector = makeConnector();
            const channel = connector.encryptedPrivateChannel("orders.1");
            const whisperCallback = vi.fn();
            const eventCallback = vi.fn();
            channel.listenForWhisper("typing", whisperCallback);
            channel.listen("OrderShipped", eventCallback);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            whisperEventSource().emitMessage(
                JSON.stringify({
                    channels: ["private-encrypted-orders.1"],
                    data: await makeJwe(
                        jwk,
                        JSON.stringify({
                            event: "client-typing",
                            payload: { name: "bob" },
                            socket: "someone-else",
                        }),
                    ),
                }),
            );

            await vi.waitFor(() =>
                expect(whisperCallback).toHaveBeenCalledWith({ name: "bob" }),
            );

            // Sealed under the right key but not a client event: a channel
            // member forging a server event through the whisper topic.
            whisperEventSource().emitMessage(
                JSON.stringify({
                    channels: ["private-encrypted-orders.1"],
                    data: await makeJwe(
                        jwk,
                        JSON.stringify({
                            event: "OrderShipped",
                            payload: { forged: true },
                        }),
                    ),
                }),
            );

            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(eventCallback).not.toHaveBeenCalled();
        });

        test("a 401 publish re-mints the cookie once and retries", async () => {
            mockWhisperAuth({ publishStatuses: [401, 200] });

            const connector = makeConnector();
            const channel = connector.privateChannel("room.1");
            const error = vi.fn();
            channel.error(error);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            const authCallsBefore = fetchMock.mock.calls.filter(
                ([url]) => url === "/broadcasting/auth",
            ).length;

            channel.whisper("typing", {});

            await vi.waitFor(() => expect(hubPublishCalls()).toHaveLength(2));

            expect(
                fetchMock.mock.calls.filter(
                    ([url]) => url === "/broadcasting/auth",
                ).length,
            ).toBe(authCallsBefore + 1);
            expect(error).not.toHaveBeenCalled();
        });

        test("a persistently failing publish surfaces on the channel's error callbacks", async () => {
            mockWhisperAuth({ publishStatuses: [500] });

            const connector = makeConnector();
            const channel = connector.privateChannel("room.1");
            const error = vi.fn();
            channel.error(error);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            channel.whisper("typing", {});

            await vi.waitFor(() => expect(error).toHaveBeenCalled());
            expect(String(error.mock.calls[0][0])).toContain("HTTP 500");
        });

        test("whisper() fails fast when the server does not grant client events", async () => {
            mockWhisperAuth({ clientEvents: false });

            const connector = makeConnector();
            const channel = connector.privateChannel("room.1");
            const error = vi.fn();
            channel.error(error);

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(1),
            );

            channel.whisper("typing", {});

            await vi.waitFor(() => expect(error).toHaveBeenCalled());
            expect(String(error.mock.calls[0][0])).toContain("client_events");
            expect(hubPublishCalls()).toHaveLength(0);
        });

        test("leaving the last guarded channel closes the whisper EventSource", async () => {
            mockWhisperAuth();

            const connector = makeConnector();
            connector.channel("news");
            connector.privateChannel("room.1");

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            const whisper = whisperEventSource();

            connector.leaveChannel("private-room.1");

            await vi.waitFor(() => expect(whisper.closed).toBe(true));
            await vi.waitFor(() =>
                expect(
                    MockEventSource.instances.filter(
                        (instance) => !instance.closed,
                    ),
                ).toHaveLength(1),
            );
        });

        test("the whisper EventSource resumes from its own last event id", async () => {
            mockWhisperAuth();

            const connector = makeConnector();
            connector.privateChannel("room.1");

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(2),
            );

            whisperEventSource().emitMessage(
                JSON.stringify({
                    channels: ["private-room.1"],
                    event: "client-typing",
                    payload: {},
                }),
                "whisper-42",
            );

            // A topology change reopens existing streams and adds the new one.
            connector.privateChannel("room.2");

            await vi.waitFor(() =>
                expect(MockEventSource.instances).toHaveLength(5),
            );

            const mainUrl = new URL(MockEventSource.instances[2].url);
            const whisperUrl = new URL(
                whisperEventSource("private-room.1").url,
            );
            const newcomerUrl = new URL(
                whisperEventSource("private-room.2").url,
            );

            expect(newcomerUrl.searchParams.has("last_event_id")).toBe(false);

            expect(whisperUrl.searchParams.get("last_event_id")).toBe(
                "whisper-42",
            );
            expect(mainUrl.searchParams.get("last_event_id")).toBeNull();
        });
    });
});
