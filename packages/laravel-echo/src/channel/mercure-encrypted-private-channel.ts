import { MercurePrivateChannel } from "./mercure-private-channel";

/**
 * This class represents an end-to-end encrypted Mercure private channel.
 *
 * Updates arrive as compact JWEs the connector decrypts with the
 * per-channel JSON Web Key returned by the broadcasting auth endpoint;
 * the hub never holds a key. The channel fails closed: only successfully
 * decrypted updates are ever dispatched to listeners. Whispers are sealed
 * under the same channel key before leaving the sender, so the hub never
 * sees their content either.
 */
export class MercureEncryptedPrivateChannel extends MercurePrivateChannel {}
