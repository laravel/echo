import { SocketIoChannel } from './socketio-channel';

/**
 * This class represents a Socket.io private channel.
 */
export class SocketIoPrivateChannel extends SocketIoChannel {
    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(eventName: string, data: any): SocketIoChannel {
        this.socket.emit('client event', {
            channel: this.name,
            event: `client-${eventName}`,
            data: data,
        });

        return this;
    }
}
