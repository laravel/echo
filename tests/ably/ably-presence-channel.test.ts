import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import { AblyPresenceChannel } from '../../src/channel';

jest.setTimeout(20000);
describe('AblyPresenceChannel', () => {
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
        echo.connector.ably.connection.once('closed', ()=> {
            done();
        });
    });

    test('channel subscription', (done) => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.subscribed(() => {
            presenceChannel.unregisterSubscribed();
            done();
        });
    });

    test.skip('channel member list change', done => {

    });

    test.skip('member joined', done=> {

    })

    test.skip('member left', done => {

    })
});