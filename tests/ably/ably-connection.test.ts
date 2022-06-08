import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';

jest.setTimeout(20000);
describe('AblyConnection', () => {
    let testApp;
    let mockAuthServer;
    let echo;

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

    test('should be able to connect to server', (done) => {
        expect.assertions(2);
        echo.connector.ably.connection.on(({ current, previous, reason }) => {
            if (current == 'connecting') {
                expect(previous).toBe('initialized');
            }
            else if (current == 'connected') {
                expect(previous).toBe('connecting');
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
                expect(previous).toBe('initialized');
            }
            else if (current == 'connected') {
                expect(previous).toBe('connecting');
                echo.disconnect();
            }
            else if (current == 'closing') {
                expect(previous).toBe('connected');
            }
            else if (current == 'closed') {
                expect(previous).toBe('closing');
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