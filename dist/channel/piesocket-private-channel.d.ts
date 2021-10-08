import { PieSocketChannel } from './piesocket-channel';
/**
 * This class represents a PieSocket private channel.
 */
export declare class PieSocketPrivateChannel extends PieSocketChannel {
    /**
     * Trigger client event on the channel.
     */
    whisper(eventName: string, data: any): PieSocketChannel;
}
