import Echo from '../src/echo';

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

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        expect(() => new Echo({ broadcaster: () => {} })).not.toThrowError('Broadcaster function is not supported.');
    });

    test('it will throw error for unsupported driver', () => {
        expect(() => new Echo({ broadcaster: 'foo' })).toThrowError('Broadcaster string foo is not supported.');
    });
});
