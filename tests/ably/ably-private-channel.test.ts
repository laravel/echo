import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import safeAssert from './setup/utils';
import { AblyChannel, AblyPrivateChannel } from '../../src/channel';
import * as Ably from 'ably';

jest.setTimeout(20000);
describe('AblyPrivateChannel', () => {
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
            echoMessages: true, // https://docs.ably.io/client-lib-development-guide/features/#TO3h
        });
    });

    afterEach((done) => {
        echo.disconnect();
        echo.connector.ably.connection.once('closed', () => {
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

    test('Whisper and listen to it', (done) => {
        const privateChannel = echo.private('test') as AblyPrivateChannel;
        privateChannel
            .subscribed(() => {
                privateChannel.whisper('msg', 'Hello there jonny!');
            })
            .listenForWhisper('msg', (data) => {
                safeAssert(() => expect(data).toBe('Hello there jonny!'), done, true);
            });
    });

    test('channel subscription error, token expired', (done) => {
        mockAuthServer.setAuthExceptions(['private:shortLivedChannel']);
        const privateChannel = echo.private('shortLivedChannel') as AblyChannel;
        privateChannel.error((stateChangeError) => {
            privateChannel.unregisterError();
            safeAssert(() => expect(stateChangeError).toBeTruthy(), done, true);
        });
    });

    test('channel subscription error, access denied', (done) => {
        mockAuthServer.setAuthExceptions([], ['private:bannedChannel']);
        const privateChannel = echo.private('bannedChannel') as AblyChannel;
        privateChannel.error((stateChangeError) => {
            privateChannel.unregisterError();
            safeAssert(() => expect(stateChangeError).toBeTruthy(), done, true);
        });
    });
});
