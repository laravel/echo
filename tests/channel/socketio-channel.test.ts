import { SocketIoChannel } from '../../src/channel';

describe('SocketIoChannel', () => {
    let channel;
    let socket;

    beforeEach(() => {
        const channelName = 'some.channel';
        let listeners = [];
        socket = {
            emit: (event, data) => listeners.filter(([e]) => e === event).forEach(([, fn]) => fn(channelName, data)),
            on: (event, fn) => listeners.push([event, fn]),
            removeListener: (event, fn) => {
                listeners = listeners.filter(([e, f]) => (!fn ? e !== event : e !== event || f !== fn));
            },
        };

        channel = new SocketIoChannel(socket, channelName, {
            namespace: false,
        });
    });

    test('triggers all listeners for an event', () => {
        const l1 = jest.fn();
        const l2 = jest.fn();
        const l3 = jest.fn();
        channel.listen('MyEvent', l1);
        channel.listen('MyEvent', l2);
        channel.listen('MyOtherEvent', l3);

        socket.emit('MyEvent', {});

        expect(l1).toBeCalled();
        expect(l2).toBeCalled();
        expect(l3).not.toBeCalled();

        socket.emit('MyOtherEvent', {});

        expect(l3).toBeCalled();
    });

    test('can remove a listener for an event', () => {
        const l1 = jest.fn();
        const l2 = jest.fn();
        const l3 = jest.fn();
        channel.listen('MyEvent', l1);
        channel.listen('MyEvent', l2);
        channel.listen('MyOtherEvent', l3);

        channel.stopListening('MyEvent', l1);

        socket.emit('MyEvent', {});

        expect(l1).not.toBeCalled();
        expect(l2).toBeCalled();
        expect(l3).not.toBeCalled();

        socket.emit('MyOtherEvent', {});

        expect(l3).toBeCalled();
    });

    test('can remove all listeners for an event', () => {
        const l1 = jest.fn();
        const l2 = jest.fn();
        const l3 = jest.fn();
        channel.listen('MyEvent', l1);
        channel.listen('MyEvent', l2);
        channel.listen('MyOtherEvent', l3);

        channel.stopListening('MyEvent');

        socket.emit('MyEvent', {});

        expect(l1).not.toBeCalled();
        expect(l2).not.toBeCalled();
        expect(l3).not.toBeCalled();

        socket.emit('MyOtherEvent', {});

        expect(l3).toBeCalled();
    });
});
