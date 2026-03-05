---
name: echo-vue-development
description: "Develops real-time broadcasting in Vue applications with Laravel Echo. Activates when configuring Echo in Vue (configureEcho); using composables (useEcho, useEchoPublic, useEchoPresence, useEchoModel, useEchoNotification, useConnectionStatus); listening for broadcast events in Vue components; implementing client events (whisper) in Vue; or when the user mentions Echo with Vue, real-time Vue composables, or broadcasting in Vue components."
license: MIT
metadata:
  author: laravel
---
@php
/** @var \Laravel\Boost\Install\GuidelineAssist $assist */
@endphp
# Laravel Echo Vue Integration

## When to Apply

Activate this skill when:

- Configuring Echo in a Vue application (`configureEcho`)
- Using Echo composables in Vue components
- Listening for broadcast events, model events, or notifications in Vue
- Implementing client events (whisper) in Vue

## Documentation

Use `search-docs` for detailed broadcasting patterns. Search for:

- "receiving broadcasts" — composable usage with full examples
- "model broadcasting" — useEchoModel for Eloquent model events
- "client events" — whisper/listenForWhisper
- "presence channels" — useEchoPresence with member tracking
- "broadcasting installation" — configureEcho setup

## Basic Usage

### Configure Echo

Call once in your app entry point (e.g., `app.ts`):

@boostsnippet("Configure Echo for Reverb", "typescript")
import { configureEcho } from "@laravel/echo-vue";

configureEcho({
    broadcaster: "reverb",
});
@endboostsnippet

All Reverb connection options (`key`, `wsHost`, `wsPort`, `wssPort`, `forceTLS`, `enabledTransports`) are auto-read from environment variables when omitted. Override explicitly only when needed.

For Pusher:

@boostsnippet("Configure Echo for Pusher", "typescript")
import { configureEcho } from "@laravel/echo-vue";

configureEcho({
    broadcaster: "pusher",
});
@endboostsnippet

### Listen for Events

@boostsnippet("Private Channel Composable", "vue")
<script setup lang="ts">
import { useEcho } from "@laravel/echo-vue";

const props = defineProps<{ orderId: number }>();

useEcho(`orders.${props.orderId}`, "OrderShipmentStatusUpdated", (e) => {
    console.log(e.order);
});
</script>
@endboostsnippet

`useEcho` defaults to private channels, subscribes on mount, unsubscribes on unmount.

Listen to multiple events:

@boostsnippet("Multiple Events", "vue")
<script setup lang="ts">
import { useEcho } from "@laravel/echo-vue";

useEcho(
    `orders.${orderId}`,
    ["OrderShipmentStatusUpdated", "OrderShipped"],
    (e) => {
        console.log(e.order);
    },
);
</script>
@endboostsnippet

### Public Channels

@boostsnippet("Public Channel Composable", "vue")
<script setup lang="ts">
import { useEchoPublic } from "@laravel/echo-vue";

useEchoPublic("posts", "PostPublished", (e) => {
    console.log(e.post);
});
</script>
@endboostsnippet

### Presence Channels

@boostsnippet("Presence Channel Composable", "vue")
<script setup lang="ts">
import { useEchoPresence } from "@laravel/echo-vue";

const { channel } = useEchoPresence("chat.1", "NewMessage", (e) => {
    console.log(e.message);
});

channel().here((users) => console.log('Current users:', users));
channel().joining((user) => console.log(`${user.name} joined`));
channel().leaving((user) => console.log(`${user.name} left`));
</script>
@endboostsnippet

### Model Broadcasting

@boostsnippet("Model Broadcasting Composable", "vue")
<script setup lang="ts">
import { useEchoModel } from "@laravel/echo-vue";

const props = defineProps<{ userId: number }>();

useEchoModel("App.Models.User", props.userId, ["UserUpdated"], (e) => {
    console.log(e.model);
});
</script>
@endboostsnippet

### Notifications

@boostsnippet("Notification Composable", "vue")
<script setup lang="ts">
import { useEchoNotification } from "@laravel/echo-vue";

useEchoNotification(`App.Models.User.${userId}`, (notification) => {
    console.log(notification);
});
</script>
@endboostsnippet

### Client Events (Whisper)

@boostsnippet("Client Events in Vue", "vue")
<script setup lang="ts">
import { useEcho } from "@laravel/echo-vue";

const { channel } = useEcho(`chat.${roomId}`, ['update'], (e) => {
    console.log('Chat event received:', e);
});

// Send typing indicator
channel().whisper('typing', { name: user.name });

// Listen for typing
channel().listenForWhisper('typing', (e) => {
    console.log(`${e.name} is typing...`);
});
</script>
@endboostsnippet

### Connection Status

@boostsnippet("Connection Status", "vue")
<script setup lang="ts">
import { useConnectionStatus } from "@laravel/echo-vue";

const status = useConnectionStatus();
// Possible values: connected, connecting, reconnecting, disconnected, failed
</script>

<template>
    <div>Connection: {{ status }}</div>
</template>
@endboostsnippet

### Type Safety

Specify payload shape using TypeScript generics:

@boostsnippet("Type-safe Event Listening", "vue")
<script setup lang="ts">
import { useEcho } from "@laravel/echo-vue";

type OrderData = {
    order: { id: number; user: { id: number; name: string } };
};

useEcho<OrderData>(`orders.${orderId}`, "OrderShipmentStatusUpdated", (e) => {
    console.log(e.order.id);
    console.log(e.order.user.name);
});
</script>
@endboostsnippet

For model broadcasts:

@boostsnippet("Type-safe Model Broadcasting", "vue")
<script setup lang="ts">
import { useEchoModel } from "@laravel/echo-vue";

type User = { id: number; name: string; email: string };

useEchoModel<User, "App.Models.User">("App.Models.User", userId, ["UserUpdated"], (e) => {
    console.log(e.model.name);
});
</script>
@endboostsnippet

### Manual Control

All composables return methods for manual control:

@boostsnippet("Manual Control", "vue")
<script setup lang="ts">
import { useEcho } from "@laravel/echo-vue";

const { leaveChannel, leave, stopListening, listen } = useEcho(
    `orders.${orderId}`,
    "OrderShipmentStatusUpdated",
    (e) => {
        console.log(e.order);
    },
);

// Stop listening without leaving channel...
stopListening();

// Start listening again...
listen();

// Leave channel...
leaveChannel();

// Leave a channel and its associated private and presence channels...
leave();
</script>
@endboostsnippet

## Available Composables

- `useEcho(channel, event, callback, deps?, visibility?)` — Private channels (default). Supports single or array of events.
- `useEchoPublic(channel, event, callback, deps?)` — Public channels (no auth)
- `useEchoPresence(channel, event, callback, deps?)` — Presence channels with member tracking
- `useEchoModel(model, id, events, callback, deps?)` — Eloquent model events (auto-constructs channel name, auto-adds dot prefix)
- `useEchoNotification(channel, callback, event?, deps?)` — Broadcast notifications
- `useConnectionStatus()` — Returns a `Ref<ConnectionStatus>` that updates reactively

All composables return `{ listen, stopListening, leaveChannel, leave, channel }` for manual control.

### Utilities

- `configureEcho(options)` — Configure the singleton Echo instance (call once in app entry point)
- `echo()` — Access the Echo instance directly (e.g., `echo().socketId()` for the X-Socket-ID header)
- `echoIsConfigured()` — Check if Echo has been configured before accessing `echo()`

### Additional Capabilities via channel()

- Client events: `channel().whisper("typing", data)` / `channel().listenForWhisper("typing", cb)`
- Notifications: `channel().notification(cb)` — alternative to `useEchoNotification`
- Channel lifecycle: `channel().subscribed(cb)` / `channel().error(cb)`

## Server-Side Reference

Use `search-docs` for detailed code examples. This section covers what's available on the backend so you can build the full end-to-end flow.

### Creating Broadcast Events

```bash
{{ $assist->artisanCommand('make:event OrderShipped') }}
```

@boostsnippet("Broadcast Event", "php")
namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;

class OrderShipped implements ShouldBroadcast
{
    use InteractsWithSockets, SerializesModels;

    public function __construct(public Order $order) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('orders.'.$this->order->id)];
    }
}
@endboostsnippet

### Channel Authorization

Define in `routes/channels.php`:

@boostsnippet("Channel Authorization", "php")
use App\Models\Order;
use App\Models\User;

Broadcast::channel('orders.{orderId}', function (User $user, int $orderId) {
    return $user->id === Order::findOrNew($orderId)->user_id;
});
@endboostsnippet

Create a channel class for complex authorization:

```bash
{{ $assist->artisanCommand('make:channel OrderChannel') }}
```

List all registered channels:

```bash
{{ $assist->artisanCommand('channel:list') }}
```

### Channel Types

- Public (`new Channel`) — no auth, anyone can subscribe. Use for app-wide announcements, public feeds, or status pages.
- Private (`new PrivateChannel`) — requires authorization. Use for user-specific data like orders, messages, or account updates.
- Presence (`new PresenceChannel`) — authorized + tracks who's online. Use for chat rooms, collaborative editing, "who's viewing this" features, or typing indicators.
- EncryptedPrivate — end-to-end encryption, Pusher/Reverb only. Use when payload must be hidden from the broadcast server (e.g., sensitive financial data or private messages).
- Drivers: `reverb` (self-hosted WebSocket server), `pusher` (managed service), `ably` (managed service), `log` (writes to Laravel log, use for debugging), `null` (no-op, use for testing)

### Event Customization

- `broadcastAs()` — custom event name (client must use dot prefix: `.listen('.custom.name')`). Use when you want stable API names decoupled from PHP class names, or shorter event names for the frontend.
- `broadcastWith()` — control exact payload. Use to avoid leaking sensitive model attributes, slim down large payloads, or add computed data not on the model.
- `broadcastWhen()` — conditional broadcasting. Use to skip broadcasting when changes are trivial (e.g., only broadcast order updates above a threshold, or skip unchanged fields).
- `broadcastQueue()` / `$queue` — route to specific queue. Use to isolate real-time broadcasts from slow background jobs so they're processed faster.
- `$connection` — set queue connection per event. Use when broadcasts should go through a faster queue backend like Redis while other jobs use the database driver.

### Broadcasting Interfaces

- `ShouldBroadcast` — queue the broadcast (default). Use for most events to avoid blocking the HTTP response.
- `ShouldBroadcastNow` — broadcast synchronously, skip queue. Use during development or for time-critical events where queue latency is unacceptable.
- `ShouldDispatchAfterCommit` — wait for DB transaction commit. Use when the event references newly created records that listeners need to query (prevents race conditions).
- `ShouldRescue` — auto-catch broadcast exceptions. Use to prevent broadcast failures (e.g., WebSocket server down) from disrupting the user's HTTP request.
- `InteractsWithSockets` — required for `toOthers()`. Use on any event where you want to exclude the sender (optimistic UI updates).
- `InteractsWithBroadcasting` — override driver per event via `broadcastVia()`. Use in multi-driver setups (e.g., some events via Reverb, others via Pusher).

### Broadcasting Helpers

- `broadcast(new Event)->toOthers()` — exclude current user's socket. Use when the client already updates optimistically from the API response to avoid duplicate updates.
- `broadcast(new Event)->via('pusher')` — override connection. Use to route specific events through a different broadcast driver than the default.
- `Broadcast::on()`, `Broadcast::private()`, `Broadcast::presence()` — anonymous broadcasting without event classes. Chain `.as('name')->with($data)->send()` or `.sendNow()`. Use for simple one-off broadcasts where creating a full event class is overkill (e.g., quick status updates, simple notifications).

### Channel Authorization Options

- Closure-based in `routes/channels.php` — use for simple authorization logic (e.g., checking ownership).
- Model binding: `Broadcast::channel('orders.{order}', fn (User $user, Order $order) => ...)` — use when authorization depends on the model instance (auto-resolves from route parameter).
- Channel classes via `{{ $assist->artisanCommand('make:channel') }}` — use for complex authorization logic that benefits from dependency injection or reusable logic across channels.
- Multiple guards: `['guards' => ['web', 'admin']]` — use when the channel should be accessible by users authenticated via different guards (e.g., both regular users and admins).

### Model Broadcasting (Server-Side)

- `BroadcastsEvents` trait auto-broadcasts created/updated/deleted/trashed/restored. Use to automatically keep clients in sync with Eloquent model changes without writing individual events.
- Channel convention: `App.Models.Post.{id}` — matches `useEchoModel` first argument.
- `broadcastAs($event)` and `broadcastWith($event)` for per-action customization. Use to send different payloads for create vs update, or suppress certain event types.
- `newBroadcastableEvent($event)` for event instance customization (e.g., `->dontBroadcastToCurrentUser()`). Use when you need to modify the underlying event object before it's dispatched.

### Running Required Processes

```bash
{{ $assist->artisanCommand('queue:work') }}    # Required for ShouldBroadcast events
{{ $assist->artisanCommand('reverb:start') }}  # Required for Reverb driver
```

## Common Pitfalls

- Queue worker must be running for `ShouldBroadcast` events. Use `ShouldBroadcastNow` during development.
- `BROADCAST_CONNECTION` not `BROADCAST_DRIVER`: Laravel 11+ renamed this env key.
- Presence channel auth must return an array of user data (`['id' => $user->id, 'name' => $user->name]`), not `true`. Returning `true` silently fails.
- Dot prefix rule: When using `broadcastAs()`, client must prefix with `.` (e.g., `.listen('.custom.name')`). Without the dot, Echo looks for `App\Events\custom.name` which silently fails.
- CORS: When frontend/backend are on different origins, add `broadcasting/auth` to `config/cors.php` paths and set `supports_credentials` to `true`.
- `channels.php` not loaded: Verify it's included in `withRouting()` in `bootstrap/app.php`.
- Reverb is long-running: Code changes require `{{ $assist->artisanCommand('reverb:restart') }}`.
- Call `configureEcho` before any composables run. Place it in your app entry point (e.g., `app.ts`), not inside a component's `<script setup>`.
- Composables auto-cleanup on unmount — do NOT manually call `leave()` or `stopListening()` in `onUnmounted`.
- Composables must be called in `<script setup>` or `setup()` — they rely on the Vue lifecycle.
- `X-Socket-ID` header is NOT auto-sent with Inertia requests. Manually add `echo().socketId()` when using `broadcast()->toOthers()`.
- SSR / "window is not defined": Guard `configureEcho` with `typeof window !== 'undefined'` in Nuxt/SSR contexts.
- One Echo instance: `configureEcho` creates a singleton. Multiple calls reuse the first configuration.
- Channel reference counting: Multiple components sharing a channel name share one subscription. The channel is only left when ALL components unmount. Don't call `leave()` unless you want to force-unsubscribe all listeners.
- Dependencies array: Pass reactive state (from `ref()` or props) in the deps array so composables re-subscribe with fresh callbacks.
- Custom event names need dot prefix: When the server uses `broadcastAs()`, listen with the exact custom name. But `useEchoModel` automatically adds the dot prefix.
