/**
 * Minimal Socket.io type shim.
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
