import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
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

    test.skip('channel subscription', (done) => {
        echo.channel('test').subscribed(() => {
            done();
        });
    });

    test('channel subscription error', done => {
        mockAuthServer.setAuthExceptions(['private:shortLivedChannel'])
        echo.private('shortLivedChannel')
            .error(stateChangeError => {
                safeAssert(()=> expect(stateChangeError).toBeTruthy(), done, true)
            });
    });

    test.skip('channel subscription error', done => {
        mockAuthServer.setAuthExceptions([], ['private:bannedChannel'])
        echo.private('bannedChannel')
            .error(stateChangeError => {
                safeAssert(()=> expect(stateChangeError).toBeTruthy(), done, true)
            });
    });
});