import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import safeAssert from './setup/utils';
import * as Ably from 'ably';
import { AblyConnector } from '../../src/connector/ably-connector';
jest.setTimeout(20000);
describe('AblyConnection', () => {
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
        if (echo.connector.ably.connection.state === 'closed') {
            done();
        } else {
            echo.disconnect();
            echo.connector.ably.connection.once('closed', () => {
                done();
            });
        }
    });

    test('should be able to connect to server', (done) => {
        expect.assertions(3);
        echo.connector.ably.connection.on(({ current, previous, reason }) => {
            if (current == 'connecting') {
                safeAssert(() => expect(previous).toBe('initialized'), done);
            } else if (current == 'connected') {
                safeAssert(() => {
                    expect(previous).toBe('connecting');
                    expect(typeof echo.socketId()).toBe('string');
                }, done);
                // Added timeout to make sure connection stays active
                setTimeout(() => {
                    echo.connector.ably.connection.off();
                    done();
                }, 3000);
            } else if (reason) {
                done(reason);
                return;
            }
        });
    });

    test('should be able to disconnect from server', (done) => {
        expect.assertions(4);
        echo.connector.ably.connection.on(({ current, previous, reason }) => {
            if (current == 'connecting') {
                safeAssert(() => expect(previous).toBe('initialized'), done);
            } else if (current == 'connected') {
                safeAssert(() => expect(previous).toBe('connecting'), done);
                echo.disconnect();
            } else if (current == 'closing') {
                safeAssert(() => expect(previous).toBe('connected'), done);
            } else if (current == 'closed') {
                safeAssert(() => expect(previous).toBe('closing'), done);
                echo.connector.ably.connection.off();
                done();
            } else if (reason) {
                done(reason);
                return;
            }
        });
    });

    test('should set ably agent header', (done) => {
        expect(echo.connector.ably.options.agents).toStrictEqual({
            'laravel-echo': AblyConnector.LIB_VERSION
        })
        //Intercept Http.do with test
        function testRequestHandler(_, __, ___, headers) {
            expect('X-Ably-Version' in headers).toBeTruthy();
            expect('Ably-Agent' in headers).toBeTruthy();
            expect(headers['Ably-Agent'].indexOf('laravel-echo/'+ AblyConnector.LIB_VERSION) > -1).toBeTruthy();
        }

        const do_inner = echo.connector.ably.http.do;
        echo.connector.ably.http.do = testRequestHandler;

        // Call all methods that use rest http calls
        echo.connector.ably.auth.requestToken();
        echo.connector.ably.time();
        echo.connector.ably.stats();
        const channel = echo.connector.ably.channels.get('http_test_channel');
        channel.publish('test', 'Testing http headers');
        channel.presence.get();

        // Clean interceptors from Http.do
        echo.connector.ably.http.do = do_inner;
        done();
    })
});
