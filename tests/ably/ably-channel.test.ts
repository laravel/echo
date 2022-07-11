import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import { AblyChannel } from '../../src/channel';
import safeAssert, { execute, sleep } from './setup/utils';

jest.setTimeout(20000);
describe('AblyChannel', () => {
    let testApp: any;
    let mockAuthServer: MockAuthServer;
    let echo: Echo;

    beforeAll(done => {
        setup((err, app) => {
            if (err) {
                done(err);
                return;
            }
            testApp = app;
            mockAuthServer = new MockAuthServer(testApp.keys[0].keyStr);
            done();
        })
    })

    afterAll((done) => {
        tearDown(testApp, (err) => {
            if (err) {
                done(err);
                return;
            }
            done();
        })
    })

    beforeEach(() => {
        echo = new Echo({
            broadcaster: 'ably',
            useTls: true,
            environment: 'sandbox',
            requestTokenFn: mockAuthServer.getSignedToken
        });
    });

    afterEach(done => {
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
            .listen('testEvent', ({ data }) => {
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
            .listen('.testEvent', ({ data }) => {
                safeAssert(() => expect(data).toBe('Hello there'), done, true);
            });
    });

    test('Listen to a whisper', done => {
        const publicChannel = echo.channel('test') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast('public:test', 'client-msg', 'Hello there');
            })
            .listenForWhisper('msg', ({ data }) => {
                safeAssert(() => expect(data).toBe('Hello there'), done, true);
            });
    })


    test('Listen to a notification', done => {
        const publicChannel = echo.channel('test') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast('public:test', 'Illuminate\\Notifications\\Events\\BroadcastNotificationCreated', 'Hello there');
            })
            .notification(({ data }) => {
                safeAssert(() => expect(data).toBe('Hello there'), done, true);
            });
    })

    test('Listen to all events', (done) => {
        const publicChannel = echo.channel('test1') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast('public:test1', 'testEvent', 'Hello there');
            })
            .listenToAll((eventName, data) => {
                safeAssert(() => {
                    expect(eventName).toBe('.testEvent');
                    expect(data).toBe('Hello there');
                }, done, true);
            });
    });

    test('stop listening to a event', async () => {
        const publicChannel = echo.channel('test') as AblyChannel;
        const eventHandler1 = jest.fn();
        const eventHandler2 = jest.fn();
        const eventHandler3 = jest.fn();


        await new Promise(resolve => {
            publicChannel
                .subscribed(resolve)
                .listen('.testEvent', eventHandler1)
                .listen('.testEvent', eventHandler2)
                .listen('.testEvent', eventHandler3)
        });

        execute(() => mockAuthServer.broadcast('public:test', 'testEvent', 'Hello there'), 4);
        await sleep(3000);
        expect(eventHandler1).toBeCalledTimes(4);
        expect(eventHandler2).toBeCalledTimes(4);
        expect(eventHandler3).toBeCalledTimes(4);
        jest.clearAllMocks();
        publicChannel.stopListening('.testEvent', eventHandler1);

        execute(() => mockAuthServer.broadcast('public:test', 'testEvent', 'Hello there'), 3);
        await sleep(3000);
        expect(eventHandler1).toBeCalledTimes(0);
        expect(eventHandler2).toBeCalledTimes(3);
        expect(eventHandler3).toBeCalledTimes(3);
        jest.clearAllMocks();
        publicChannel.stopListening('.testEvent');

        execute(() => mockAuthServer.broadcast('public:test', 'testEvent', 'Hello there'), 3);
        await sleep(3000);
        expect(eventHandler1).toBeCalledTimes(0);
        expect(eventHandler2).toBeCalledTimes(0);
        expect(eventHandler3).toBeCalledTimes(0);

    })

    // internally calls stop listening to a event
    test('stop listening to a whisper/client-event', async () => {
        const publicChannel = echo.channel('test') as AblyChannel;
        const eventHandler1 = jest.fn();
        const eventHandler2 = jest.fn();
        const eventHandler3 = jest.fn();

        await new Promise(resolve => {
            publicChannel
                .subscribed(resolve)
                .listenForWhisper('msg', eventHandler1)
                .listenForWhisper('msg', eventHandler2)
                .listenForWhisper('msg2', eventHandler3)

        });

        execute(() => mockAuthServer.broadcast('public:test', 'client-msg', 'Hello there'), 4);
        execute(() => mockAuthServer.broadcast('public:test', 'client-msg2', 'Hello there'), 1);
        await sleep(4000);
        expect(eventHandler1).toBeCalledTimes(4);
        expect(eventHandler2).toBeCalledTimes(4);
        expect(eventHandler3).toBeCalledTimes(1);
        jest.clearAllMocks();
        publicChannel.stopListeningForWhisper('msg', eventHandler1);

        execute(() => mockAuthServer.broadcast('public:test', 'client-msg', 'Hello there'), 3);
        execute(() => mockAuthServer.broadcast('public:test', 'client-msg2', 'Hello there'), 2);
        await sleep(3000);
        expect(eventHandler1).toBeCalledTimes(0);
        expect(eventHandler2).toBeCalledTimes(3);
        expect(eventHandler3).toBeCalledTimes(2);

    })
});