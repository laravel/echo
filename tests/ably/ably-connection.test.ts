import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';

jest.setTimeout(20000);
describe.skip('AblyConnection', () => {
    let testApp;
    let mockAuthServer;

    beforeAll(done => {
        console.log('before all called');
        setup((err, app) => {
            if (err) {
                done(err);
                return;
            }
            testApp = app;
            console.log(testApp);
            mockAuthServer = new MockAuthServer(testApp.keys[0].keyStr);
            done();
        })
    })

    test('should be able to connect to server', (done) => {
        const echo = new Echo({
            broadcaster: 'ably',
            useTls: true,
            environment: 'sandbox',
            requestTokenFn: mockAuthServer.getSignedToken
        });
        echo.connector.ably.connection.on(({ current, reason }) => {
            console.log(current, reason);
            if (current == 'connected') {
                done();
            }
            if (reason) {
                done(reason)
            }
        });
    })

    afterAll((done) => {
        console.log('after all called');
        tearDown(testApp, (err) => {
            if (err) {
                done(err);
                return;
            }
            done();
        })
    })
});