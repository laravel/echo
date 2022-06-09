import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import safeAssert from './setup/utils';
import { AblyChannel } from '../../src/channel';

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
        echo.connector.ably.connection.once('closed', ()=> {
            done();
        });
    });

    test('channel subscription', (done) => {
        const channel = echo.private('test') as AblyChannel;
        channel.subscribed(() => {
            channel._removeSubscribed();
            done();
        });
    });

    // TODO - fix recursived attach when connection is closed, reproduce using API_KEY instead of sandbox
    test('channel subscription error, token expired', done => {
        mockAuthServer.setAuthExceptions(['private:shortLivedChannel']);
        const channel = echo.private('shortLivedChannel') as AblyChannel;
        channel
            .error(stateChangeError => {
                channel._removeError();
                safeAssert(() => expect(stateChangeError).toBeTruthy(), done, true)
            });
    });

    test('channel subscription error, access denied', done => {
        mockAuthServer.setAuthExceptions([], ['private:bannedChannel']);
        const channel = echo.private('bannedChannel') as AblyChannel;
        channel
            .error(stateChangeError => {
                channel._removeError();
                safeAssert(() => expect(stateChangeError).toBeTruthy(), done, true)
            });
    });
});