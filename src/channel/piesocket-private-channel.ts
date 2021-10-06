import { PieSocketChannel } from './piesocket-channel';

/**
 * This class represents a PieSocket private channel.
 */
export class PieSocketPrivateChannel extends PieSocketChannel {
    /**
     * Trigger client event on the channel.
     */
     whisper(eventName: string, data: any): PieSocketChannel {
        this.publish(`client-${eventName}`, data);

        return this;
    }
}
