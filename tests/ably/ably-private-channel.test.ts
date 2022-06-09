import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import safeAssert from './setup/utils';
import { AblyChannel, AblyPrivateChannel } from '../../src/channel';

jest.setTimeout(20000);
describe('AblyPrivateChannel', () => {
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
        const privateChannel = echo.private('test') as AblyChannel;
        privateChannel.subscribed(() => {
            privateChannel.unregisterSubscribed();
            done();
        });
    });

    test('Whisper and listen to it', done => {
        const privateChannel = echo.private('test') as AblyPrivateChannel;
        privateChannel
            .subscribed(() => {
                privateChannel.whisper('msg', 'Hello there jonny!');
            })
            .listenForWhisper('msg', ({ data }) => {
                safeAssert(() => expect(data).toBe('Hello there jonny!'), done, true);
            });
    })

    // TODO - fix recursived attach when connection is closed, reproduce using API_KEY instead of sandbox
    test('channel subscription error, token expired', done => {
        mockAuthServer.setAuthExceptions(['private:shortLivedChannel']);
        const privateChannel = echo.private('shortLivedChannel') as AblyChannel;
        privateChannel
            .error(stateChangeError => {
                privateChannel.unregisterError();
                safeAssert(() => expect(stateChangeError).toBeTruthy(), done, true)
            });
    });

    test('channel subscription error, access denied', done => {
        mockAuthServer.setAuthExceptions([], ['private:bannedChannel']);
        const privateChannel = echo.private('bannedChannel') as AblyChannel;
        privateChannel
            .error(stateChangeError => {
                privateChannel.unregisterError();
                safeAssert(() => expect(stateChangeError).toBeTruthy(), done, true)
            });
    });
});