import {
    MercureChannel,
    MercureEncryptedPrivateChannel,
    MercurePresenceChannel,
    MercurePrivateChannel,
} from "../channel";
import type { ConnectionStatus } from "../echo";
import { Connector } from "./connector";

type AnyMercureChannel =
    | MercureChannel
    | MercurePrivateChannel
    | MercureEncryptedPrivateChannel
    | MercurePresenceChannel;

/**
 * Options specific to the Mercure connector, on top of the generic Echo
 * options.
 */
export type MercureOptions = {
    /**
     * The URL of the Mercure hub. A relative path (e.g. a same-origin
     * reverse-proxied hub) resolves against the page. Defaults to the
     * spec's well-known path on the current origin; required outside a
     * browser.
     */
    host?: string | null;

    /**
     * The EventSource implementation to use. Defaults to the global
     * EventSource; required in environments without one (e.g. Node.js).
     */
    eventSource?: typeof EventSource;
};

/**
 * The default hub path, per the Mercure specification.
 */
const DEFAULT_HUB_PATH = "/.well-known/mercure";

/**
 * The longest delay between reconnection attempts after the browser gave
 * up on the EventSource (e.g. the short-lived subscriber cookie expired
 * and the hub answered non-2xx).
 */
const MAX_RECONNECT_DELAY = 30000;

/**
 * The most channels a single auth request may cover, mirroring the
 * server-side cap in MercureBroadcaster::auth().
 */
const MAX_CHANNELS = 100;

/**
 * The SSE "event" field the hub sets on every update it generates itself
 * (currently subscription events only). Regular broadcasts are sent as
 * unnamed ("message") events.
 */
const SUBSCRIPTION_EVENT_TYPE = "mercure";

/**
 * The prefix of end-to-end encrypted channels.
 */
const ENCRYPTED_PREFIX = "private-encrypted-";

/**
 * The event-name prefix of whispers (client events), matching the wire
 * format of the other Echo drivers.
 */
const WHISPER_EVENT_PREFIX = "client-";

/**
 * This class creates a connector to a Mercure hub.
 *
 * Every joined topic — public, private, and presence alike — is
 * multiplexed over a single EventSource. Adding or removing a topic tears
 * down and reopens the connection with the full, current topic list, after
 * (re)authenticating to mint the one subscriber cookie that covers all of
 * them. Delivery of guarded content is gated by the "private" flag on the
 * published update (see MercureBroadcaster::broadcast() server-side), not
 * by the token's grants, so a public topic stays visible to every
 * subscriber regardless of what their token grants.
 *
 * End-to-end encrypted channels ("private-encrypted-*") arrive as compact
 * JWEs that only this connector can open, using the per-channel JSON Web
 * Key the auth endpoint returned when the channel was authorized: the hub
 * relays them without ever holding a key. The channel fails closed — a
 * plaintext update targeting an encrypted channel is never dispatched.
 *
 * Whispers (client events) use one EventSource per guarded channel with
 * whisper listeners, each subscribed to that channel's exact whisper
 * topic. Native EventSource does not expose the publishing topic:
 * multiplexing these topics would let a member of one channel route a
 * whisper to another through its untrusted envelope. The envelope must
 * name the stream's own channel.
 *
 * Each whisper stream dispatches only "client-*" events, independently
 * from the main server-event stream. Streams open lazily on the first
 * listenForWhisper() of their channel — sending is a plain POST and needs
 * none — so the extra SSE connections cost only what whispers are
 * actually used for; HTTP/2 or HTTP/3 is still recommended to avoid
 * HTTP/1.1 connection limits. Payloads are peer-generated: never treat
 * them as server truth.
 */
export class MercureConnector extends Connector<
    "mercure",
    MercureChannel,
    MercurePrivateChannel,
    MercurePresenceChannel
> {
    /**
     * All of the subscribed channels, keyed by their full (prefixed) name.
     */
    channels: Record<string, AnyMercureChannel> = {};

    /**
     * The base URL of the Mercure hub.
     *
     * Assigned in connect() during the base constructor, before this
     * class's field initializers run — "declare" keeps it that way under
     * any class-fields target.
     */
    declare private url: URL;

    /**
     * The underlying EventSource for the current topic set, if any.
     */
    private eventSource: EventSource | null = null;

    /**
     * The last received SSE id, carried forward across reconnections so no
     * update is missed or replayed twice.
     */
    private lastEventId = "";

    /**
     * Whisper-only EventSources, each bound to one guarded channel.
     */
    private whisperEventSources = new Map<string, EventSource>();

    /**
     * Independent replay cursors: activity on one channel must not advance
     * another channel's cursor when the streams are reopened.
     */
    private whisperLastEventIds = new Map<string, string>();

    /**
     * Names of the channels with at least one whisper listener — the only
     * ones needing a whisper stream. A name stays in the set until its
     * channel is left, so removing the last listener keeps the stream.
     */
    private whisperListening = new Set<string>();

    /**
     * Whether the server mints whisper (client event) grants, as reported
     * by the auth endpoint; false for servers predating whispers.
     */
    private clientEventsEnabled = false;

    /**
     * The hub topic prefix reported by the auth endpoint, mapping channel
     * names to namespaced hub topics; empty for servers predating topic
     * namespacing, whose topics are the bare channel names.
     */
    private topicPrefix = "";

    /**
     * Serializes outgoing whisper publishes, preserving per-sender order
     * across the asynchronous fetch boundary.
     */
    private whisperQueue: Promise<void> = Promise.resolve();

    /**
     * An id for this connection, used only for {@see socketId} /
     * `toOthers()` self-exclusion — generated locally and echoed back in
     * the broadcast envelope by {@see MercureBroadcaster::broadcast()}.
     */
    private id: string = randomId();

    /**
     * The current connection status.
     */
    private status: ConnectionStatus = "disconnected";

    /**
     * Registered connection-status change listeners.
     */
    private statusListeners: Array<(status: ConnectionStatus) => void> = [];

    /**
     * Whether a refresh of the shared connection is currently in flight.
     */
    private refreshing = false;

    /**
     * Whether the topic set changed again while a refresh was in flight,
     * and another refresh is needed once it completes.
     */
    private refreshPending = false;

    /**
     * The channel names covered by the last successful auth request. When
     * a later batch is denied, the difference identifies the newly joined
     * channels to evict so the previously working set can recover (the
     * batch is all-or-nothing server-side).
     */
    private authorizedChannels = new Set<string>();

    /**
     * Full names of channels whose subscribed() callbacks already fired
     * for the current connection, so a topology-change reopen doesn't
     * re-fire them; cleared when the connection is actually lost.
     */
    private subscribedNotified = new Set<string>();

    /**
     * Full names of presence channels whose subscription-API snapshot has
     * already been fetched, so a later refresh cycle (e.g. one triggered by
     * joining an unrelated channel) doesn't re-fetch and re-seed it.
     */
    private seededPresenceChannels = new Set<string>();

    /**
     * Subscription events buffered per presence channel between the
     * EventSource opening and that channel's snapshot landing, replayed
     * through the regular dedupe once seeded.
     */
    private pendingSubscriptionEvents = new Map<
        string,
        Array<[string, boolean, unknown]>
    >();

    /**
     * The decryption JSON Web Keys of the authorized end-to-end encrypted
     * channels, as returned by the auth endpoint.
     */
    private channelJwks = new Map<string, JsonWebKey>();

    /**
     * Imported WebCrypto keys, cached per channel until its JWK rotates.
     */
    private importedKeys = new Map<
        string,
        { k: string; key: Promise<CryptoKey> }
    >();

    /**
     * Serializes encrypted-update dispatches, preserving per-channel event
     * order across the asynchronous WebCrypto boundary.
     */
    private dispatchQueue: Promise<void> = Promise.resolve();

    /**
     * A generation counter, bumped by {@see disconnect}: an in-flight
     * refresh compares the value it captured at entry after every await
     * and bails when it went stale, so a disconnect issued mid-refresh
     * can't be undone by that refresh opening a fresh connection anyway.
     */
    private epoch = 0;

    /**
     * The delay before the next scheduled reconnection attempt, doubled on
     * every consecutive failure (up to {@see MAX_RECONNECT_DELAY}) and
     * reset once a connection opens.
     */
    private reconnectDelay = 1000;

    /**
     * The pending reconnection timer, if any.
     */
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * The subscriber cookie's lifetime in seconds, as reported by the auth
     * endpoint's "expires_in", or null when it didn't report one.
     */
    private tokenTtl: number | null = null;

    /**
     * When the cookie was last (re)minted, as an epoch millisecond.
     */
    private lastAuthAt = 0;

    /**
     * The pending proactive cookie-refresh timer, if any.
     *
     * The cookie is httpOnly, so its expiry can't be observed from here;
     * refreshing ahead of "expires_in" keeps it valid before the hub ever
     * has a chance to drop the connection over it.
     */
    private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Create a fresh Mercure connection.
     *
     * Runs during the base {@see Connector} constructor, before this
     * subclass's own field initializers have applied — it must not read or
     * write any of them (directly, or indirectly through a method like
     * {@see setStatus} that does).
     */
    connect(): void {
        const inBrowser = typeof window !== "undefined";

        if (this.options.host == null && !inBrowser) {
            throw new Error(
                'Mercure connector: the "host" option (the hub URL) is required outside a browser.',
            );
        }

        try {
            // The base argument lets a relative "host" (e.g. a same-origin
            // reverse-proxied hub path like "/.well-known/mercure") resolve
            // against the page instead of throwing.
            this.url = new URL(
                this.options.host ?? DEFAULT_HUB_PATH,
                inBrowser ? window.location.origin : undefined,
            );
        } catch {
            throw new Error(
                `Mercure connector: the "host" option ("${String(this.options.host)}") is not a valid hub URL.`,
            );
        }
    }

    /**
     * The EventSource implementation to open connections with.
     */
    private eventSourceClass(): typeof EventSource {
        const implementation =
            (this.options as MercureOptions).eventSource ??
            globalThis.EventSource;

        if (implementation === undefined) {
            throw new Error(
                'Mercure connector: EventSource is not available globally; pass an implementation via the "eventSource" option.',
            );
        }

        return implementation;
    }

    /**
     * The hub's subscription-API base path, derived from the hub URL so a
     * hub mounted on a nonstandard path keeps working.
     *
     * @see https://mercure.rocks/spec#active-subscriptions
     */
    private subscriptionsPath(): string {
        return `${this.url.pathname.replace(/\/$/, "")}/subscriptions`;
    }

    /**
     * The hub topic of the given channel. The channel name is encoded into
     * a single path segment, mirroring MercureBroadcaster::channelTopic();
     * without a server-reported prefix (a pre-namespacing server), topics
     * are the bare channel names.
     */
    private channelTopic(name: string): string {
        return this.topicPrefix === ""
            ? name
            : `${this.topicPrefix}channel/${encodeChannelName(name)}`;
    }

    /**
     * The whisper topic of the given channel — the only kind of topic the
     * subscriber cookie may publish to, mirroring
     * MercureBroadcaster::whisperTopic(). Only meaningful when the server
     * reported a topic prefix, which every whisper-capable server does.
     */
    private whisperTopic(name: string): string {
        return `${this.topicPrefix}whisper/${encodeChannelName(name)}`;
    }

    /**
     * Map an exact-match hub topic back to its channel name, or null when
     * the topic lives outside the channel namespace.
     */
    private channelNameFromTopic(topic: string): string | null {
        if (this.topicPrefix === "") {
            return topic;
        }

        const namespace = `${this.topicPrefix}channel/`;

        if (!topic.startsWith(namespace)) {
            return null;
        }

        try {
            return decodeURIComponent(topic.slice(namespace.length));
        } catch {
            return null;
        }
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(
        name: string,
        event: string,
        callback: CallableFunction,
    ): AnyMercureChannel {
        return this.channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     */
    channel(name: string): MercureChannel {
        if (!this.channels[name]) {
            this.channels[name] = new MercureChannel(name, this.options, this);
            this.refresh();
        }

        return this.channels[name];
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): MercurePrivateChannel {
        const fullName = "private-" + name;

        if (!this.channels[fullName]) {
            this.channels[fullName] = new MercurePrivateChannel(
                fullName,
                this.options,
                this,
            );
            this.refresh();
        }

        return this.channels[fullName];
    }

    /**
     * Get an end-to-end encrypted private channel instance by name.
     */
    encryptedPrivateChannel(name: string): MercureEncryptedPrivateChannel {
        const fullName = ENCRYPTED_PREFIX + name;

        if (!this.channels[fullName]) {
            this.channels[fullName] = new MercureEncryptedPrivateChannel(
                fullName,
                this.options,
                this,
            );
            this.refresh();
        }

        return this.channels[fullName];
    }

    /**
     * Get a presence channel instance by name.
     */
    presenceChannel(name: string): MercurePresenceChannel {
        const fullName = "presence-" + name;

        if (!this.channels[fullName]) {
            this.channels[fullName] = new MercurePresenceChannel(
                fullName,
                this.options,
                this,
            );
            this.refresh();
        }

        return this.channels[fullName] as MercurePresenceChannel;
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void {
        ["", "private-", ENCRYPTED_PREFIX, "presence-"].forEach((prefix) =>
            this.leaveChannel(prefix + name),
        );
    }

    /**
     * Leave the given channel.
     */
    leaveChannel(name: string): void {
        if (this.channels[name]) {
            delete this.channels[name];
            this.forgetChannelState(name);
            this.refresh();
        }
    }

    /**
     * Get the socket ID for the connection.
     */
    socketId(): string {
        return this.id;
    }

    /**
     * Publish a whisper (client event) on the given channel's whisper
     * topic, directly to the hub: the subscriber cookie carries the
     * publish grant, so no server round-trip is involved.
     *
     * @internal called by the channel.
     */
    whisper(name: string, event: string, data: unknown): void {
        const channel = this.channels[name];

        if (!channel) {
            return;
        }

        if (!this.clientEventsEnabled) {
            channel.notifyError(
                new Error(
                    `whisper("${event}"): the server did not grant client events; enable the "client_events" option of the Mercure broadcasting connection.`,
                ),
            );

            return;
        }

        this.whisperQueue = this.whisperQueue.then(() =>
            this.publishWhisper(name, WHISPER_EVENT_PREFIX + event, data).catch(
                (error: unknown) => {
                    this.channels[name]?.notifyError(error);
                },
            ),
        );
    }

    /**
     * Mark the given channel as listening for whispers, opening its
     * whisper stream when the channel is already authorized (otherwise
     * the next refresh opens it).
     *
     * @internal called by the channel.
     */
    listenForWhispers(name: string): void {
        if (this.whisperListening.has(name) || !this.channels[name]) {
            return;
        }

        this.whisperListening.add(name);
        this.syncWhisperEventSources();
    }

    /**
     * POST a whisper update to the hub's publish endpoint, authenticated
     * by the subscriber cookie. On an encrypted channel, the envelope is
     * sealed under the channel key first — byte-compatible with the
     * server-published format, so the receive path needs no special case.
     *
     * A 401 usually means the short-lived cookie expired: it is re-minted
     * through the auth endpoint once, and the publish retried.
     */
    private async publishWhisper(
        name: string,
        wireEvent: string,
        data: unknown,
    ): Promise<void> {
        let updateData: string;

        if (name.startsWith(ENCRYPTED_PREFIX)) {
            updateData = JSON.stringify({
                channels: [name],
                data: await this.encrypt(
                    name,
                    JSON.stringify({
                        event: wireEvent,
                        payload: data,
                        socket: this.id,
                    }),
                ),
            });
        } else {
            updateData = JSON.stringify({
                channels: [name],
                event: wireEvent,
                payload: data,
                socket: this.id,
            });
        }

        const publish = () =>
            fetch(`${this.url.origin}${this.url.pathname}`, {
                method: "POST",
                credentials: "include",
                // URLSearchParams sets the form content type itself,
                // keeping the request "simple": no CORS preflight.
                body: new URLSearchParams({
                    topic: this.whisperTopic(name),
                    data: updateData,
                    private: "on",
                }),
            });

        let response = await publish();

        if (response.status === 401 && this.channels[name]) {
            const auth = await this.authenticate(Object.keys(this.channels));

            if (auth.ok) {
                response = await publish();
            }
        }

        if (!response.ok) {
            throw new Error(
                `The whisper publish on "${name}" failed with HTTP ${response.status}.`,
            );
        }
    }

    /**
     * Get the current connection status.
     */
    connectionStatus(): ConnectionStatus {
        return this.status;
    }

    /**
     * Subscribe to connection status changes.
     */
    onConnectionChange(
        callback: (status: ConnectionStatus) => void,
    ): () => void {
        this.statusListeners.push(callback);

        return () => {
            this.statusListeners = this.statusListeners.filter(
                (registered) => registered !== callback,
            );
        };
    }

    /**
     * Disconnect the Mercure connection.
     */
    disconnect(): void {
        this.epoch++; // strands any in-flight refresh (see doRefresh)
        this.channels = {};
        this.authorizedChannels.clear();
        this.subscribedNotified.clear();
        this.seededPresenceChannels.clear();
        this.pendingSubscriptionEvents.clear();
        this.channelJwks.clear();
        this.importedKeys.clear();
        this.lastEventId = "";
        this.whisperLastEventIds.clear();
        this.whisperListening.clear();
        this.clientEventsEnabled = false;
        this.topicPrefix = "";

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectDelay = 1000;

        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
            this.tokenRefreshTimer = null;
        }

        this.eventSource?.close();
        this.eventSource = null;
        this.closeWhisperEventSources();
        this.setStatus("disconnected");
    }

    /**
     * Update the connection status and notify listeners.
     */
    private setStatus(status: ConnectionStatus): void {
        this.status = status;
        this.statusListeners.forEach((callback) => callback(status));
    }

    /**
     * Drop the connector-side bookkeeping of a channel that left or was
     * evicted.
     */
    private forgetChannelState(name: string): void {
        this.authorizedChannels.delete(name);
        this.subscribedNotified.delete(name);
        this.seededPresenceChannels.delete(name);
        this.pendingSubscriptionEvents.delete(name);
        this.channelJwks.delete(name);
        this.importedKeys.delete(name);
        this.whisperEventSources.get(name)?.close();
        this.whisperEventSources.delete(name);
        this.whisperLastEventIds.delete(name);
        this.whisperListening.delete(name);
    }

    /**
     * Evict the given channels, surfacing the reason on each channel's
     * error() callbacks.
     */
    private evict(names: string[], error: Error): void {
        names.forEach((name) => {
            const channel = this.channels[name];

            if (!channel) {
                return;
            }

            delete this.channels[name];
            this.forgetChannelState(name);
            channel.notifyError(error);
        });
    }

    /**
     * Notify every channel's error() callbacks.
     */
    private notifyAllError(error: unknown): void {
        Object.values(this.channels).forEach((channel) =>
            channel.notifyError(error),
        );
    }

    /**
     * The full names of every currently-joined private/presence channel.
     *
     * Matched by name prefix, not `instanceof`, to mirror the server's
     * UsePusherChannelConventions::isGuardedChannel() exactly: the whisper
     * topics derived here must byte-match the grants the server minted for
     * the same names. The presence-only `instanceof` checks elsewhere serve
     * a different purpose (dispatching to subclass behavior).
     */
    private guardedChannelNames(): string[] {
        return Object.keys(this.channels).filter(
            (name) =>
                name.startsWith("private-") || name.startsWith("presence-"),
        );
    }

    /**
     * Tear down and reopen the shared EventSource for the current topic
     * set. Calls arriving while a refresh is already in flight coalesce
     * into a single trailing refresh.
     */
    private refresh(): void {
        this.runExclusive(() => this.doRefresh());
    }

    /**
     * Run the given refresh work unless one is already in flight, in which
     * case a single trailing refresh is scheduled instead. A failure never
     * strands the connection: it surfaces on the channels and retries with
     * backoff.
     */
    private runExclusive(work: () => Promise<void>): void {
        if (this.refreshing) {
            this.refreshPending = true;

            return;
        }

        this.refreshing = true;

        void work()
            .catch((error) => {
                // Typically a user callback throwing from here()/joining():
                // surface it instead of leaving an unhandled rejection and
                // a status stuck on "connecting".
                this.notifyAllError(error);

                if (Object.keys(this.channels).length > 0) {
                    this.setStatus("reconnecting");
                    this.scheduleReconnect();
                }
            })
            .finally(() => {
                this.refreshing = false;

                if (this.refreshPending) {
                    this.refreshPending = false;
                    this.refresh();
                }
            });
    }

    /**
     * Schedule a proactive cookie refresh well before the auth endpoint's
     * reported "expires_in" elapses. Only the cookie is re-minted — the
     * EventSource keeps running, and the browser's automatic reconnection
     * presents the fresh cookie once the hub drops the old one.
     */
    private scheduleTokenRefresh(): void {
        if (this.tokenTtl === null) {
            return;
        }

        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
        }

        const epoch = this.epoch;

        this.tokenRefreshTimer = setTimeout(
            () => {
                this.tokenRefreshTimer = null;

                if (
                    epoch !== this.epoch ||
                    Object.keys(this.channels).length === 0
                ) {
                    return;
                }

                // If the timer fired far too late (e.g. the machine slept),
                // the hub has likely already dropped the connection and the
                // browser re-attached anonymously: rebuild the connection
                // outright instead of only refreshing the cookie under it.
                if (
                    this.tokenTtl !== null &&
                    Date.now() - this.lastAuthAt >= this.tokenTtl * 1000
                ) {
                    this.refresh();

                    return;
                }

                this.runExclusive(async () => {
                    const auth = await this.authenticate(
                        Object.keys(this.channels),
                    );

                    if (epoch !== this.epoch) {
                        return;
                    }

                    if (auth.ok) {
                        // Access revoked mid-session: drop the denied
                        // channels and rebuild the streams without them,
                        // leaving the others uninterrupted.
                        if (auth.denied.length > 0) {
                            this.evict(
                                auth.denied,
                                new Error(
                                    `The broadcasting auth request denied access to [${auth.denied.join(", ")}].`,
                                ),
                            );
                            this.refresh();
                        }

                        this.scheduleTokenRefresh();
                    } else {
                        // Retry the full cycle with backoff rather than
                        // waiting for the hub to drop the connection once
                        // the cookie actually expires.
                        this.notifyAllError(auth.error);
                        this.scheduleReconnect();
                    }
                });
            },
            Math.max(this.tokenTtl * 0.8 * 1000, 5000),
        );
    }

    /**
     * Schedule a full re-auth + reopen after the browser abandoned the
     * EventSource, backing off exponentially while the failure persists.
     *
     * @see refresh
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            return;
        }

        const epoch = this.epoch;

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;

            if (
                epoch !== this.epoch ||
                Object.keys(this.channels).length === 0
            ) {
                return;
            }

            this.refresh();
        }, this.reconnectDelay);

        this.reconnectDelay = Math.min(
            this.reconnectDelay * 2,
            MAX_RECONNECT_DELAY,
        );
    }

    /**
     * @see refresh
     */
    private async doRefresh(): Promise<void> {
        const epoch = this.epoch;

        // Let every join/leave from the same tick land before capturing the
        // channel set, so a burst of joins costs one auth request and one
        // connection instead of one per call.
        await Promise.resolve();

        if (epoch !== this.epoch) {
            return;
        }

        // Everything up to this point is captured below, so a trailing
        // refresh is only needed for changes arriving from here on.
        this.refreshPending = false;

        let channelNames = Object.keys(this.channels);

        if (channelNames.length === 0) {
            this.eventSource?.close();
            this.eventSource = null;
            this.closeWhisperEventSources();
            this.authorizedChannels.clear();
            this.setStatus("disconnected");

            return;
        }

        // Enforce the server's batch cap here, with a message naming the
        // actual limit instead of an opaque 403.
        if (channelNames.length > MAX_CHANNELS) {
            this.evict(
                channelNames.slice(MAX_CHANNELS),
                new Error(
                    `Mercure broadcasting authorizes at most ${MAX_CHANNELS} channels per connection.`,
                ),
            );
            channelNames = channelNames.slice(0, MAX_CHANNELS);
        }

        if (!this.eventSource) {
            this.setStatus("connecting");
        }

        // The previous EventSource keeps running while authenticating, so
        // a failed auth can't take down channels that were working.
        const auth = await this.authenticate(channelNames);

        if (epoch !== this.epoch) {
            return;
        }

        if (!auth.ok) {
            const newcomers = channelNames.filter(
                (name) =>
                    !this.authorizedChannels.has(name) && this.channels[name],
            );

            // The batch is all-or-nothing server-side: when a request the
            // server actively rejected contains newly joined channels, drop
            // them (surfacing the denial on their error() callbacks only —
            // the surviving channels recover transparently through the
            // trailing refresh) and re-auth the previously working set.
            if (auth.rejected && newcomers.length > 0) {
                this.evict(
                    newcomers,
                    new Error(
                        `The broadcasting auth request was denied (HTTP ${String(auth.status)}) after joining [${newcomers.join(", ")}].`,
                    ),
                );
                this.refreshPending = true;

                return;
            }

            // Transient failure (or a denial of the whole existing set,
            // e.g. after logging out): every channel is affected, so all
            // hear it. Keep the current EventSource running and retry with
            // backoff.
            this.notifyAllError(auth.error);
            this.setStatus("reconnecting");
            this.scheduleReconnect();

            return;
        }

        // Denied channels are reported individually: evict them and carry
        // on with the granted subset, so one revoked channel never takes
        // down the others.
        if (auth.denied.length > 0) {
            this.evict(
                auth.denied,
                new Error(
                    `The broadcasting auth request denied access to [${auth.denied.join(", ")}].`,
                ),
            );

            channelNames = channelNames.filter((name) => this.channels[name]);

            if (channelNames.length === 0) {
                this.eventSource?.close();
                this.eventSource = null;
                this.closeWhisperEventSources();
                this.authorizedChannels.clear();
                this.setStatus("disconnected");

                return;
            }
        }

        this.authorizedChannels = new Set(channelNames);
        this.scheduleTokenRefresh();

        // Start buffering subscription events for the presence channels
        // about to be seeded, before the EventSource that carries them
        // opens (see seedPresenceChannels).
        channelNames
            .filter(
                (name) =>
                    this.channels[name] instanceof MercurePresenceChannel &&
                    !this.seededPresenceChannels.has(name) &&
                    !this.pendingSubscriptionEvents.has(name),
            )
            .forEach((name) => this.pendingSubscriptionEvents.set(name, []));

        const url = this.buildSubscribeUrl(
            channelNames.map((name) => this.channelTopic(name)),
            channelNames
                .filter(
                    (name) =>
                        this.channels[name] instanceof MercurePresenceChannel,
                )
                .map((name) => this.subscriptionEventsPattern(name)),
            this.lastEventId,
        );

        const EventSourceImplementation = this.eventSourceClass();

        this.eventSource?.close();

        const eventSource = new EventSourceImplementation(url.toString(), {
            withCredentials: true,
        });

        this.eventSource = eventSource;

        eventSource.onopen = () => {
            this.reconnectDelay = 1000;
            this.setStatus("connected");

            Object.entries(this.channels).forEach(([name, channel]) => {
                if (!this.subscribedNotified.has(name)) {
                    this.subscribedNotified.add(name);
                    channel.notifySubscribed();
                }
            });

            // Now that the connection (and thus this subscriber's own hub
            // subscription) exists, the snapshot includes self — here()
            // gets the current user, and joining() only ever fires for
            // others, matching Echo's presence semantics elsewhere.
            void this.seedPresenceChannels(epoch);
        };

        eventSource.onerror = (event) => {
            this.notifyAllError(event);

            this.setStatus("reconnecting");

            // 2 = EventSource.CLOSED; the constant is read off the
            // implementation, which may not be the global one.
            if (eventSource.readyState === EventSourceImplementation.CLOSED) {
                // The browser gave up for good (a non-2xx response, e.g. an
                // expired cookie, is terminal per the SSE spec): re-auth and
                // reopen ourselves, with backoff against a persistent
                // failure. The hub also dropped this subscriber, so its
                // presence snapshots and subscribed() notifications belong
                // to a dead connection.
                this.subscribedNotified.clear();
                this.seededPresenceChannels.clear();
                this.pendingSubscriptionEvents.clear();
                this.scheduleReconnect();
            }
            // Otherwise native EventSource retry is already in progress.
        };

        eventSource.onmessage = (event: MessageEvent) =>
            this.handleMessage(event);

        eventSource.addEventListener(SUBSCRIPTION_EVENT_TYPE, (event) =>
            this.handleSubscriptionEvent(event),
        );

        this.syncWhisperEventSources();
    }

    /**
     * Build a subscribe URL for the hub with the given exact-topic and
     * URLPattern matchers, on a clone so the base URL never accumulates
     * query parameters across (or between) the EventSources.
     */
    private buildSubscribeUrl(
        matches: string[],
        urlPatterns: string[],
        lastEventId: string,
    ): URL {
        const url = new URL(this.url);

        url.search = "";
        matches.forEach((match) => url.searchParams.append("match", match));
        urlPatterns.forEach((pattern) =>
            url.searchParams.append("match_urlpattern", pattern),
        );

        if (lastEventId) {
            url.searchParams.set("last_event_id", lastEventId);
        }

        return url;
    }

    /**
     * Close the whisper streams without discarding their replay cursors.
     */
    private closeWhisperEventSources(): void {
        this.whisperEventSources.forEach((source) => source.close());
        this.whisperEventSources.clear();
    }

    /**
     * Reconcile the per-channel whisper streams with the channels that
     * currently need one: authorized guarded channels with at least one
     * whisper listener. Streams are opened lazily — sending needs no
     * stream (whisper() is a POST, and senders never receive their own
     * whispers) — so clients that never call listenForWhisper() pay no
     * extra connections. Healthy streams survive unrelated topology
     * changes; only dead (terminally closed) ones are replaced.
     * Connection status still tracks the main stream; terminal failures
     * use the existing shared re-authentication and reconnect path.
     */
    private syncWhisperEventSources(): void {
        const CLOSED = this.eventSourceClass().CLOSED;

        const desired = new Set(
            this.clientEventsEnabled
                ? this.guardedChannelNames().filter(
                      (name) =>
                          this.authorizedChannels.has(name) &&
                          this.whisperListening.has(name),
                  )
                : [],
        );

        this.whisperEventSources.forEach((source, name) => {
            if (!desired.has(name) || source.readyState === CLOSED) {
                source.close();
                this.whisperEventSources.delete(name);
            }
        });

        if (!this.clientEventsEnabled) {
            this.whisperLastEventIds.clear();

            return;
        }

        desired.forEach((name) => {
            if (!this.whisperEventSources.has(name)) {
                this.openWhisperEventSource(name);
            }
        });
    }

    /**
     * Open the exact-topic whisper stream of the given guarded channel,
     * resuming from its own replay cursor.
     */
    private openWhisperEventSource(name: string): void {
        const EventSourceImplementation = this.eventSourceClass();

        const eventSource = new EventSourceImplementation(
            this.buildSubscribeUrl(
                [this.whisperTopic(name)],
                [],
                this.whisperLastEventIds.get(name) ?? "",
            ).toString(),
            { withCredentials: true },
        );

        this.whisperEventSources.set(name, eventSource);

        eventSource.onmessage = (event: MessageEvent) => {
            if (this.whisperEventSources.get(name) !== eventSource) {
                return;
            }

            this.whisperLastEventIds.set(name, event.lastEventId);
            this.handleWhisperMessage(event, name);
        };

        eventSource.onerror = () => {
            if (
                this.whisperEventSources.get(name) === eventSource &&
                eventSource.readyState === EventSourceImplementation.CLOSED
            ) {
                this.scheduleReconnect();
            }
        };
    }

    /**
     * Seed the subscription-API snapshot of every presence channel that
     * started buffering in doRefresh(), then replay the buffered live
     * events through the channel's own dedupe.
     */
    private async seedPresenceChannels(epoch: number): Promise<void> {
        await Promise.all(
            [...this.pendingSubscriptionEvents.keys()].map(async (name) => {
                const channel = this.channels[name];

                if (!(channel instanceof MercurePresenceChannel)) {
                    this.pendingSubscriptionEvents.delete(name);

                    return;
                }

                try {
                    const members = await this.fetchPresenceSnapshot(name);

                    if (epoch !== this.epoch) {
                        return;
                    }

                    this.seededPresenceChannels.add(name);
                    channel.setInitialMembers(members);

                    (this.pendingSubscriptionEvents.get(name) ?? []).forEach(
                        ([subscriber, active, payload]) =>
                            channel.applySubscriptionEvent(
                                subscriber,
                                active,
                                payload,
                            ),
                    );
                } catch (error) {
                    // Not latched: the next refresh retries. Surface the
                    // failure instead of faking an empty room via here([]).
                    channel.notifyError(error);
                } finally {
                    this.pendingSubscriptionEvents.delete(name);
                }
            }),
        );
    }

    /**
     * Handle a regular broadcast update: the envelope published by
     * {@see MercureBroadcaster::broadcast()}.
     *
     * Updates without a routable envelope are dropped silently: raw hub
     * publishers aren't addressable to Echo channels.
     */
    private handleMessage(event: MessageEvent): void {
        this.lastEventId = event.lastEventId;

        const message = parseJson<{
            channels?: unknown;
            event?: unknown;
            payload?: unknown;
            socket?: unknown;
            data?: unknown;
        }>(event.data as string);

        if (!message || !Array.isArray(message.channels)) {
            return;
        }

        const channels = message.channels.filter(
            (name): name is string => typeof name === "string",
        );

        // An end-to-end encrypted update: the routing envelope is
        // plaintext, everything else (event name included) is inside the
        // JWE. Decryption is async, so dispatches are queued to keep the
        // per-channel event order.
        if (typeof message.data === "string") {
            const data = message.data;

            channels
                .filter(
                    (name) =>
                        name.startsWith(ENCRYPTED_PREFIX) &&
                        hasOwn(this.channels, name),
                )
                .forEach((name) => {
                    this.dispatchQueue = this.dispatchQueue.then(() =>
                        this.dispatchEncrypted(name, data),
                    );
                });

            return;
        }

        if (message.socket && message.socket === this.id) {
            return;
        }

        if (typeof message.event !== "string") {
            return;
        }

        channels.forEach((name) => {
            // Fail closed: an encrypted channel only ever dispatches
            // decrypted content, so a plaintext update targeting it (e.g.
            // injected by a compromised hub) is dropped.
            if (
                !name.startsWith(ENCRYPTED_PREFIX) &&
                hasOwn(this.channels, name)
            ) {
                this.channels[name].dispatch(
                    message.event as string,
                    message.payload,
                );
            }
        });
    }

    /**
     * Handle an update from a stream bound to the given guarded channel.
     *
     * The channel comes from the exact-topic subscription, never from the
     * attacker-controlled envelope. Only "client-*" events addressed at
     * that same channel are dispatched; everything else is dropped
     * silently (warning here would be attacker-amplifiable
     * noise). Encrypted channels get the same rule after decryption, plus
     * cryptographic channel binding for free — a JWE sealed under another
     * channel's key fails its GCM tag.
     */
    private handleWhisperMessage(event: MessageEvent, name: string): void {
        const message = parseJson<{
            channels?: unknown;
            event?: unknown;
            payload?: unknown;
            socket?: unknown;
            data?: unknown;
        }>(event.data as string);

        if (
            !message ||
            !Array.isArray(message.channels) ||
            message.channels.length !== 1 ||
            message.channels[0] !== name
        ) {
            return;
        }

        if (!hasOwn(this.channels, name)) {
            return;
        }

        if (typeof message.data === "string") {
            const data = message.data;

            if (name.startsWith(ENCRYPTED_PREFIX)) {
                this.dispatchQueue = this.dispatchQueue.then(() =>
                    this.dispatchEncrypted(name, data, true),
                );
            }

            return;
        }

        // Senders always stamp their socket id, so a whisper never echoes
        // back to its own sender (matching the other Echo drivers).
        if (message.socket && message.socket === this.id) {
            return;
        }

        if (
            typeof message.event !== "string" ||
            !message.event.startsWith(WHISPER_EVENT_PREFIX) ||
            name.startsWith(ENCRYPTED_PREFIX)
        ) {
            return;
        }

        this.channels[name].dispatch(message.event, message.payload);
    }

    /**
     * Decrypt an end-to-end encrypted update and dispatch it to its
     * channel, or surface the failure on the channel's error() callbacks —
     * never dispatching anything that didn't authenticate under the
     * channel key.
     */
    private async dispatchEncrypted(
        name: string,
        serializedJwe: string,
        whisper = false,
    ): Promise<void> {
        const channel = this.channels[name];

        if (!channel) {
            return;
        }

        try {
            const plaintext = await this.decrypt(name, serializedJwe);
            const message = parseJson<{
                event?: unknown;
                payload?: unknown;
                socket?: unknown;
            }>(plaintext);

            if (!message || typeof message.event !== "string") {
                throw new Error(
                    `The decrypted update on "${name}" carries no broadcast envelope.`,
                );
            }

            // A decrypted non-client event on the whisper path is a
            // protocol violation from a channel member: drop it.
            if (whisper && !message.event.startsWith(WHISPER_EVENT_PREFIX)) {
                return;
            }

            if (message.socket && message.socket === this.id) {
                return;
            }

            channel.dispatch(message.event, message.payload);
        } catch (error) {
            channel.notifyError(error);
        }
    }

    /**
     * Decrypt a compact JWE published by the server-side
     * MercureChannelEncrypter: direct encryption ("alg": "dir", empty
     * encrypted-key segment) under AES-256-GCM, with the protected-header
     * segment as additional authenticated data per RFC 7516. WebCrypto
     * rejects any forged or cross-channel ciphertext via the GCM tag.
     */
    private async decrypt(
        name: string,
        serializedJwe: string,
    ): Promise<string> {
        const segments = serializedJwe.split(".");

        if (segments.length !== 5 || segments[1] !== "") {
            throw new Error(
                `The update on "${name}" is not a direct-encryption compact JWE.`,
            );
        }

        const [protectedSegment, , ivSegment, ciphertextSegment, tagSegment] =
            segments;

        const header = parseJson<{ alg?: unknown; enc?: unknown }>(
            textDecoder.decode(base64UrlDecode(protectedSegment)),
        );

        if (header?.alg !== "dir" || header?.enc !== "A256GCM") {
            throw new Error(
                `The update on "${name}" uses an unsupported JWE algorithm.`,
            );
        }

        const ciphertext = base64UrlDecode(ciphertextSegment);
        const tag = base64UrlDecode(tagSegment);
        const sealed = new Uint8Array(ciphertext.length + tag.length);
        sealed.set(ciphertext);
        sealed.set(tag, ciphertext.length);

        const plaintext = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: base64UrlDecode(ivSegment),
                additionalData: textEncoder.encode(protectedSegment),
                tagLength: 128,
            },
            await this.channelKey(name),
            sealed,
        );

        return textDecoder.decode(plaintext);
    }

    /**
     * Seal a whisper envelope into the compact JWE format decrypt()
     * (and the server-side encrypter) expects: direct encryption under the
     * channel key, AES-256-GCM, protected header as additional
     * authenticated data.
     */
    private async encrypt(name: string, plaintext: string): Promise<string> {
        const protectedSegment = ENCRYPTED_PROTECTED_HEADER;
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const sealed = new Uint8Array(
            await crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv,
                    additionalData: textEncoder.encode(protectedSegment),
                    tagLength: 128,
                },
                await this.channelKey(name),
                textEncoder.encode(plaintext),
            ),
        );

        // WebCrypto appends the 16-byte GCM tag to the ciphertext; the
        // compact serialization keeps them in separate segments.
        const ciphertext = sealed.slice(0, -16);
        const tag = sealed.slice(-16);

        return [
            protectedSegment,
            "",
            base64UrlEncode(iv),
            base64UrlEncode(ciphertext),
            base64UrlEncode(tag),
        ].join(".");
    }

    /**
     * Import (and cache) the WebCrypto key of the given encrypted channel
     * from the JWK the auth endpoint shared for it.
     */
    private channelKey(name: string): Promise<CryptoKey> {
        const jwk = this.channelJwks.get(name);

        if (!jwk || typeof jwk.k !== "string") {
            return Promise.reject(
                new Error(
                    `No decryption key is known for "${name}": the auth endpoint returned none. Is "encryption_key" configured server-side?`,
                ),
            );
        }

        const cached = this.importedKeys.get(name);

        if (cached && cached.k === jwk.k) {
            return cached.key;
        }

        const key = crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"],
        );

        this.importedKeys.set(name, { k: jwk.k, key });

        return key;
    }

    /**
     * Handle a hub-generated subscription (active:true/false) event, and
     * route it to whichever presence channel it targets.
     *
     * Only exact-match subscriptions carrying a member payload count: the
     * hub publishes a subscription event for *any* subscriber that merely
     * requested the topic (authorized to read it or not), and only
     * authorized presence subscribers have the server-attached payload.
     */
    private handleSubscriptionEvent(event: MessageEvent): void {
        this.lastEventId = event.lastEventId;

        const subscription = parseJson<{
            match?: unknown;
            match_type?: unknown;
            subscriber?: unknown;
            active?: unknown;
            payload?: unknown;
        }>(event.data as string);

        if (
            !subscription ||
            typeof subscription.match !== "string" ||
            typeof subscription.subscriber !== "string" ||
            typeof subscription.active !== "boolean" ||
            subscription.match_type !== "exact"
        ) {
            return;
        }

        if (subscription.active && subscription.payload == null) {
            return; // an unauthorized (phantom) subscription: not a member
        }

        const name = this.channelNameFromTopic(subscription.match);

        if (name === null) {
            return;
        }

        const buffer = this.pendingSubscriptionEvents.get(name);

        if (buffer) {
            buffer.push([
                subscription.subscriber,
                subscription.active,
                subscription.payload,
            ]);

            return;
        }

        if (!hasOwn(this.channels, name)) {
            return;
        }

        const channel = this.channels[name];

        if (channel instanceof MercurePresenceChannel) {
            channel.applySubscriptionEvent(
                subscription.subscriber,
                subscription.active,
                subscription.payload,
            );
        }
    }

    /**
     * Fetch the subscription-API snapshot for a presence channel's topic
     * to seed its member list. Runs after the EventSource opened, so the
     * snapshot includes this subscriber's own subscription; the gap
     * between the two is covered by the event buffering in doRefresh().
     */
    private async fetchPresenceSnapshot(
        name: string,
    ): Promise<Array<[string, unknown]>> {
        const response = await fetch(
            `${this.url.origin}${this.subscriptionsPath()}/exact/${encodeChannelName(this.channelTopic(name))}`,
            { credentials: "include" },
        );

        if (!response.ok) {
            throw new Error(
                `The subscription snapshot request failed with HTTP ${response.status}.`,
            );
        }

        const snapshot = (await response.json()) as {
            subscriptions?: Array<{
                subscriber: string;
                active: boolean;
                payload?: unknown;
            }>;
        };

        return (snapshot.subscriptions ?? [])
            .filter(
                // Same phantom filter as handleSubscriptionEvent: only
                // subscribers with a server-attached payload are members.
                (subscription) =>
                    subscription.active && subscription.payload != null,
            )
            .map((subscription) => [
                subscription.subscriber,
                subscription.payload,
            ]);
    }

    /**
     * POST the full set of currently-joined channel names — public ones
     * included — to the auth endpoint, so the server can mint one
     * subscriber cookie covering all of them at once, and record the
     * decryption keys it returns for the encrypted channels.
     */
    private async authenticate(channelNames: string[]): Promise<{
        ok: boolean;
        rejected: boolean;
        status: number | null;
        denied: string[];
        error?: Error;
    }> {
        let error: Error;
        let status: number | null = null;

        try {
            const response = await fetch(this.options.authEndpoint, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...this.options.auth.headers,
                },
                body: JSON.stringify({ channel_names: channelNames }),
            });

            if (response.ok) {
                this.lastAuthAt = Date.now();

                return {
                    ok: true,
                    rejected: false,
                    status: response.status,
                    denied: this.readAuthResponse(await parseBody(response)),
                };
            }

            status = response.status;
            error = new Error(
                `The broadcasting auth request to "${this.options.authEndpoint}" failed with HTTP ${response.status}.`,
            );
        } catch (cause) {
            error = new Error(
                `The broadcasting auth request to "${this.options.authEndpoint}" failed: ${cause instanceof Error ? cause.message : String(cause)}.`,
            );
        }

        // The caller routes the error to the channels actually affected —
        // an eviction only concerns the evicted channels, for instance.
        // 5xx and network failures are worth retrying as-is; a 4xx means
        // the server actively rejected this batch.
        return {
            ok: false,
            rejected: status !== null && status < 500,
            status,
            denied: [],
            error,
        };
    }

    /**
     * Record what the auth endpoint reported — the cookie TTL driving the
     * proactive refresh, and the per-channel decryption JWKs of the
     * authorized end-to-end encrypted channels — and return the channels
     * the server denied individually.
     */
    private readAuthResponse(body: unknown): string[] {
        const response = (body ?? {}) as {
            expires_in?: unknown;
            channel_names?: unknown;
            topic_prefix?: unknown;
            client_events?: unknown;
        };

        const ttl = Number(response.expires_in);
        this.tokenTtl = Number.isFinite(ttl) && ttl > 0 ? ttl : null;

        this.topicPrefix =
            typeof response.topic_prefix === "string"
                ? response.topic_prefix
                : "";
        this.clientEventsEnabled = response.client_events === true;

        this.channelJwks.clear();

        const denied: string[] = [];

        if (Array.isArray(response.channel_names)) {
            response.channel_names.forEach((entry: unknown) => {
                const channel = (entry ?? {}) as {
                    name?: unknown;
                    jwk?: unknown;
                    denied?: unknown;
                };

                if (typeof channel.name !== "string") {
                    return;
                }

                if (channel.denied === true) {
                    denied.push(channel.name);

                    return;
                }

                if (channel.jwk !== null && typeof channel.jwk === "object") {
                    this.channelJwks.set(channel.name, channel.jwk);
                }
            });
        }

        return denied;
    }

    /**
     * Build the subscription-events topic matcher for a presence channel,
     * so its subscriber also receives active:true/false events for every
     * other subscriber of that channel.
     */
    private subscriptionEventsPattern(channelName: string): string {
        return `${this.subscriptionsPath()}/:match_type/${encodeChannelName(this.channelTopic(channelName))}/:subscriber`;
    }
}

/**
 * Whether the given object has the given key as an own property — a
 * hub-supplied channel name like "__proto__" must not resolve through the
 * prototype chain.
 */
function hasOwn(object: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Parse JSON, returning null instead of throwing on malformed input.
 */
function parseJson<T>(text: string): T | null {
    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
}

/**
 * Read a response body as JSON, tolerating an empty or non-JSON body.
 */
async function parseBody(response: Response): Promise<unknown> {
    try {
        return (await response.json()) as unknown;
    } catch {
        return null;
    }
}

/**
 * Shared text codecs: the WebCrypto paths run per message, so the encoder
 * and decoder are built once rather than on every encrypt/decrypt.
 */
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * The compact-JWE protected header of every encrypted update: direct
 * encryption under AES-256-GCM. Channel-independent and constant, so it is
 * encoded once (it also serves as the additional authenticated data).
 */
const ENCRYPTED_PROTECTED_HEADER = base64UrlEncode(
    textEncoder.encode(JSON.stringify({ alg: "dir", enc: "A256GCM" })),
);

/**
 * Decode an unpadded URL-safe base64 (RFC 7515) segment.
 */
function base64UrlDecode(segment: string): Uint8Array<ArrayBuffer> {
    const padded =
        segment.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - (segment.length % 4)) % 4);

    return Uint8Array.from(atob(padded), (character) =>
        character.charCodeAt(0),
    );
}

/**
 * Encode bytes as an unpadded URL-safe base64 (RFC 7515) segment.
 */
function base64UrlEncode(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/**
 * Percent-encode a channel name for use inside a subscription-API URL or
 * URLPattern, matching the server side's rawurlencode(): also encodes "!",
 * "'", "(", ")", and "*" (a URLPattern wildcard), so patterns stay
 * byte-identical to the grants minted by MercureBroadcaster.
 */
function encodeChannelName(name: string): string {
    return encodeURIComponent(name).replace(
        /[!'()*]/g,
        (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
    );
}

/**
 * A random id for `toOthers()` self-exclusion — echoed back by the server
 * only in updates this same connection triggered.
 */
function randomId(): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
