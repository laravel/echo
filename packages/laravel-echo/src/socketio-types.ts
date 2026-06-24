/**
 * Minimal Socket.io type shim.
 *
 * These interfaces mirror the subset of socket.io-client that Laravel Echo
 * actually uses. Declaring them locally means the compiled echo.d.ts does not
 * unconditionally import from "socket.io-client", so projects that only use
 * Reverb or Pusher no longer need that package installed.
 *
 * When socket.io-client is installed the real types satisfy these interfaces,
 * so nothing changes for Socket.io users.
 */

export interface SocketIoManager {
    /** @internal */
    _reconnecting: boolean;
    on(event: string, callback: (...args: any[]) => void): this;
}

export interface SocketIoSocket {
    id: string | undefined;
    connected: boolean;
    io: SocketIoManager;
    on(event: string, callback: (...args: any[]) => void): this;
    off(event: string, callback?: (...args: any[]) => void): this;
    removeListener(event: string, callback?: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): this;
    disconnect(): this;
}

export type SocketIoFunction = (
    uri?: string,
    opts?: Record<string, unknown>,
) => SocketIoSocket;
