# Laravel Echo Vue Helpers

## `configureEcho`

You must call this function somewhere in your app _before_ you use `useEcho` in a component to configure your Echo instance. You only need to pass the required data:

```ts
import { configureEcho } from "@laravel/echo-vue";

configureEcho({
    broadcaster: "reverb",
});
```

Based on your brodcaster, the package will fill in appropriate defaults for the rest of the config [based on the Echo documentation](https://laravel.com/docs/broadcasting#client-side-installation). You can always override these values by simply passing in your own.

In the above example, the configuration would also fill in the following keys if they aren't present:

```ts
{
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT,
    wssPort: import.meta.env.VITE_REVERB_PORT,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
}
```

## Connection Status

You can get the current WebSocket connection status using the `useConnectionStatus` composable or the `echo().connectionStatus()` utility function.

### `useConnectionStatus` Composable (Reactive)

The `useConnectionStatus` composable provides **reactive** connection status that automatically updates when the connection state changes. Use this in Vue components that need to display live connection status:

```vue
<script setup>
import { useConnectionStatus } from "@laravel/echo-vue";

const status = useConnectionStatus(); // Automatically updates when status changes

const getStatusColor = (status) => {
    switch (status) {
        case "connected":
            return "green";
        case "connecting":
            return "yellow";
        case "reconnecting":
            return "orange";
        case "failed":
            return "red";
        default:
            return "gray";
    }
};
</script>

<template>
    <div :style="{ color: getStatusColor(status) }">
        Connection: {{ status }}
    </div>
</template>
```

### Status Values

- `"connected"` - Successfully connected to the WebSocket server
- `"disconnected"` - Not connected and not attempting to reconnect
- `"connecting"` - Initial connection attempt in progress
- `"reconnecting"` - Attempting to reconnect after a disconnection
- `"failed"` - Connection failed and won't retry

## `useEcho` Hook

Connect to private channel:

```ts
import { useEcho } from "@laravel/echo-vue";

const { leaveChannel, leave, stopListening, listen } = useEcho(
    `orders.${orderId}`,
    "OrderShipmentStatusUpdated",
    (e) => {
        console.log(e.order);
    },
);

// Stop listening without leaving channel
stopListening();

// Start listening again
listen();

// Leave channel
leaveChannel();

// Leave a channel and also its associated private and presence channels
leave();
```

Multiple events:

```ts
useEcho(
    `orders.${orderId}`,
    ["OrderShipmentStatusUpdated", "OrderShipped"],
    (e) => {
        console.log(e.order);
    },
);
```

Specify shape of payload data:

```ts
type OrderData = {
    order: {
        id: number;
        user: {
            id: number;
            name: string;
        };
        created_at: string;
    };
};

useEcho<OrderData>(`orders.${orderId}`, "OrderShipmentStatusUpdated", (e) => {
    console.log(e.order.id);
    console.log(e.order.user.id);
});
```

Connect to public channel:

```ts
useEchoPublic("posts", "PostPublished", (e) => {
    console.log(e.post);
});
```

Connect to presence channel:

```ts
useEchoPresence("posts", "PostPublished", (e) => {
    console.log(e.post);
});
```

Listening for model events:

```ts
useEchoModel("App.Models.User", userId, ["UserCreated", "UserUpdated"], (e) => {
    console.log(e.model);
});
```
