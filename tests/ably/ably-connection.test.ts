import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import safeAssert from './setup/utils';

jest.setTimeout(20000);
describe('AblyConnection', () => {
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
        if (echo.connector.ably.connection.state === 'closed') {
            done();
        } else {
            echo.disconnect();
            echo.connector.ably.connection.once('closed', ()=> {
                done();
            });
        }
    });

    test('should be able to connect to server', (done) => {
        expect.assertions(3);
        echo.connector.ably.connection.on(({ current, previous, reason }) => {
            if (current == 'connecting') {
                safeAssert(() => expect(previous).toBe('initialized'), done);
            }
            else if (current == 'connected') {
                safeAssert(() => {
                    expect(previous).toBe('connecting');
                    expect(typeof echo.socketId()).toBe('string');
                }, done);
                setTimeout(() => { // Added timeout to make sure connection stays active
                    echo.connector.ably.connection.off();
                    done();
                }, 3000)
            }
            else if (reason) {
                done(reason);
                return;
            }
        });
    })

    test('should be able to disconnect from server', (done) => {
        expect.assertions(4);
        echo.connector.ably.connection.on(({ current, previous, reason }) => {
            if (current == 'connecting') {
                safeAssert(() => expect(previous).toBe('initialized'), done);
            }
            else if (current == 'connected') {
                safeAssert(() => expect(previous).toBe('connecting'), done);
                echo.disconnect();
            }
            else if (current == 'closing') {
                safeAssert(() => expect(previous).toBe('connected'), done);
            }
            else if (current == 'closed') {
                safeAssert(() => expect(previous).toBe('closing'), done);
                echo.connector.ably.connection.off();
                done();
            }
            else if (reason) {
                done(reason);
                return;
            }
        });
    })
});