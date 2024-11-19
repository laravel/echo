import Echo from '../src/echo';
import { NullConnector } from '../src/connector';

describe('Echo', () => {
    test('it will not throw error for supported driver', () => {
        expect(() => new Echo({ broadcaster: 'reverb' })).not.toThrowError(
            'Broadcaster string reverb is not supported.'
        );

        expect(() => new Echo({ broadcaster: 'pusher' })).not.toThrowError(
            'Broadcaster string pusher is not supported.'
        );

        expect(() => new Echo({ broadcaster: 'socket.io' })).not.toThrowError(
            'Broadcaster string socket.io is not supported.'
        );

        expect(() => new Echo({ broadcaster: 'null' })).not.toThrowError('Broadcaster string null is not supported.');
        expect(() => new Echo({ broadcaster: NullConnector })).not.toThrowError();

        // eslint-disable-next-line
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        expect(() => new Echo({ broadcaster: () => {} })).not.toThrowError('Broadcaster function is not supported.');
    });

    test('it will throw error for unsupported driver', () => {
        // eslint-disable-next-line
        // @ts-ignore
        expect(() => new Echo({ broadcaster: 'foo' })).toThrowError('Broadcaster string foo is not supported.');
    });
});
