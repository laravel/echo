import { SocketIoChannel } from '../../src/channel';
import type { Socket } from 'socket.io-client';
import { Connector } from '../../src/connector';

describe('SocketIoChannel', () => {
    let channel: SocketIoChannel;
    let socket: Socket;

    beforeEach(() => {
        const channelName = 'some.channel';
        let listeners: any[] = [];
        socket = {
            emit: (event: any, data: unknown) => {
                listeners.filter(([e]) => e === event).forEach(([, fn]) => fn(channelName, data));
            },
            on: (event: any, fn): any => listeners.push([event, fn]),
            removeListener: (event: any, fn: any) => {
                listeners = listeners.filter(([e, f]) => (!fn ? e !== event : e !== event || f !== fn));
            },
        } as Socket;

        channel = new SocketIoChannel(socket, channelName, {
            broadcaster: 'socket.io',
            ...Connector._defaultOptions,
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
