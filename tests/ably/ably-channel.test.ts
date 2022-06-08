import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import { AblyChannel } from '../../src/channel';
import safeAssert from './setup/utils';

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

    afterEach(() => {
        echo.disconnect();
    });

    test('channel subscription', (done) => {
        echo.channel('test').subscribed(() => {
            done();
        });
    });

    test('Listen for a default broadcaster event', (done) => {
        const publicChannel = echo.channel('test') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast('public:test', 'App\\Events\\testEvent', 'Hello there');
            })
            .listen('testEvent', data => {
                safeAssert(() => expect(data).toBe('Hello there'), done);
            });
    });

    // https://laravel.com/docs/9.x/broadcasting#broadcast-name
    test('Listen for a broadcast as event', (done) => {
        const publicChannel = echo.channel('test') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast('public:test', 'testEvent', 'Hello there');
            })
            .listen('.testEvent', data => {
                safeAssert(() => expect(data).toBe('Hello there'), done);
            });
    });

    test('Listen for all events', (done) => {
        const publicChannel = echo.channel('test1') as AblyChannel;
        publicChannel
            .subscribed(() => {
                mockAuthServer.broadcast('public:test1', 'testEvent', 'Hello there');
            })
            .listenToAll((eventName, data) => {
                safeAssert(() => {
                    expect(eventName).toBe('.testEvent');
                    expect(data).toBe('Hello there');
                }, done);
            });
    })

});