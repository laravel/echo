import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import { AblyChannel, AblyPresenceChannel } from '../../src/channel';
import safeAssert, { execute } from './setup/utils';
import * as Ably from 'ably';
import waitForExpect from 'wait-for-expect';

jest.setTimeout(20000);
describe('AblyChannel', () => {
    let testApp: any;
    let mockAuthServer: MockAuthServer;
    let echo: Echo;

    beforeAll(async () => {
        global.Ably = Ably;
        testApp = await setup();
        mockAuthServer = new MockAuthServer(testApp.keys[0].keyStr);
    });

    afterAll(async () => {
        return await tearDown(testApp);
    });

    beforeEach(() => {
        echo = new Echo({
            broadcaster: 'ably',
            useTls: true,
            environment: 'sandbox',
            requestTokenFn: mockAuthServer.getSignedToken,
        });
    });

    afterEach((done) => {
        echo.disconnect();
        echo.connector.ably.connection.once('closed', () => {
            done();
        });
    });

    test('channel subscription', (done) => {
        echo.channel('test').subscribed(() => {
            done();
        });
    });

    test('Listen to a default broadcaster event', (done) => {
        const publicChannel = echo.channel('test') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast('public:test', 'App\\Events\\testEvent', 'Hello there');
            })
            .listen('testEvent', (data) => {
                safeAssert(() => expect(data).toBe('Hello there'), done, true);
            });
    });

    // https://laravel.com/docs/9.x/broadcasting#broadcast-name
    test('Listen to a broadcast as event', (done) => {
        const publicChannel = echo.channel('test') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast('public:test', 'testEvent', 'Hello there');
            })
            .listen('.testEvent', (data) => {
                safeAssert(() => expect(data).toBe('Hello there'), done, true);
            });
    });

    test('Listen to a whisper', (done) => {
        const publicChannel = echo.channel('test') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast('public:test', 'client-msg', 'Hello there');
            })
            .listenForWhisper('msg', (data) => {
                safeAssert(() => expect(data).toBe('Hello there'), done, true);
            });
    });

    test('Listen to a notification', (done) => {
        const publicChannel = echo.channel('test') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast(
                    'public:test',
                    'Illuminate\\Notifications\\Events\\BroadcastNotificationCreated',
                    'Hello there'
                );
            })
            .notification((data) => {
                safeAssert(() => expect(data).toBe('Hello there'), done, true);
            });
    });

    test('Listen to all events', (done) => {
        const publicChannel = echo.channel('test1') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast('public:test1', 'testEvent', 'Hello there');
            })
            .listenToAll((eventName, data) => {
                safeAssert(
                    () => {
                        expect(eventName).toBe('.testEvent');
                        expect(data).toBe('Hello there');
                    },
                    done,
                    true
                );
            });
    });

    test('stop listening to a event', async () => {
        const publicChannel = echo.channel('test') as AblyChannel;
        const eventHandler1 = jest.fn();
        const eventHandler2 = jest.fn();
        const eventHandler3 = jest.fn();

        await new Promise((resolve) => {
            publicChannel
                .subscribed(resolve)
                .listen('.testEvent', eventHandler1)
                .listen('.testEvent', eventHandler2)
                .listen('.testEvent', eventHandler3);
        });

        execute(() => mockAuthServer.broadcast('public:test', 'testEvent', 'Hello there'), 4);

        await waitForExpect(() => {
            expect(eventHandler1).toBeCalledTimes(4);
            expect(eventHandler2).toBeCalledTimes(4);
            expect(eventHandler3).toBeCalledTimes(4);
        });

        jest.clearAllMocks();
        publicChannel.stopListening('.testEvent', eventHandler1);

        execute(() => mockAuthServer.broadcast('public:test', 'testEvent', 'Hello there'), 3);

        await waitForExpect(() => {
            expect(eventHandler1).toBeCalledTimes(0);
            expect(eventHandler2).toBeCalledTimes(3);
            expect(eventHandler3).toBeCalledTimes(3);
        });

        jest.clearAllMocks();
        publicChannel.stopListening('.testEvent');

        execute(() => mockAuthServer.broadcast('public:test', 'testEvent', 'Hello there'), 3);

        await waitForExpect(() => {
            expect(eventHandler1).toBeCalledTimes(0);
            expect(eventHandler2).toBeCalledTimes(0);
            expect(eventHandler3).toBeCalledTimes(0);
        });
    });

    // internally calls stop listening to a event
    test('stop listening to a whisper/client-event', async () => {
        const publicChannel = echo.channel('test') as AblyChannel;
        const eventHandler1 = jest.fn();
        const eventHandler2 = jest.fn();
        const eventHandler3 = jest.fn();

        await new Promise((resolve) => {
            publicChannel
                .subscribed(resolve)
                .listenForWhisper('msg', eventHandler1)
                .listenForWhisper('msg', eventHandler2)
                .listenForWhisper('msg2', eventHandler3);
        });

        execute(() => mockAuthServer.broadcast('public:test', 'client-msg', 'Hello there'), 4);
        execute(() => mockAuthServer.broadcast('public:test', 'client-msg2', 'Hello there'), 1);

        await waitForExpect(() => {
            expect(eventHandler1).toBeCalledTimes(4);
            expect(eventHandler2).toBeCalledTimes(4);
            expect(eventHandler3).toBeCalledTimes(1);
        });

        jest.clearAllMocks();
        publicChannel.stopListeningForWhisper('msg', eventHandler1);

        execute(() => mockAuthServer.broadcast('public:test', 'client-msg', 'Hello there'), 3);
        execute(() => mockAuthServer.broadcast('public:test', 'client-msg2', 'Hello there'), 2);

        await waitForExpect(() => {
            expect(eventHandler1).toBeCalledTimes(0);
            expect(eventHandler2).toBeCalledTimes(3);
            expect(eventHandler3).toBeCalledTimes(2);
        });
    });

    test('Leave channel', async () => {
        const publicChannel = echo.channel('test') as AblyChannel;
        const privateChannel = echo.private('test') as AblyChannel;
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        const publicChannelSubscription = new Promise((resolve) => publicChannel.subscribed(resolve));
        const privateChannelSubscription = new Promise((resolve) => privateChannel.subscribed(resolve));
        const presenceChannelSubscription = new Promise((resolve) => presenceChannel.subscribed(resolve));

        await Promise.all([publicChannelSubscription, privateChannelSubscription, presenceChannelSubscription]);

        echo.leave('test');

        const publicDetachPromise = new Promise((resolve) => publicChannel.channel.on('detached', resolve));
        const privateDetachPromise = new Promise((resolve) => privateChannel.channel.on('detached', resolve));
        const presenceDetachPromise = new Promise((resolve) => presenceChannel.channel.on('detached', resolve));

        await Promise.all([publicDetachPromise, privateDetachPromise, presenceDetachPromise]);
    });
});
