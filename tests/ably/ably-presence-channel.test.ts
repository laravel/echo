import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import { AblyPresenceChannel } from '../../src/channel';
import safeAssert from './setup/utils';
import * as Ably from 'ably';

jest.setTimeout(20000);
describe('AblyPresenceChannel', () => {
    let testApp: any;
    let mockAuthServer: MockAuthServer;
    let echo: Echo;

    beforeAll(async () => {
        testApp = await setup();
        mockAuthServer = new MockAuthServer(testApp.keys[0].keyStr);
    })

    afterAll(async() => {
        return await tearDown(testApp);
    })

    beforeEach(() => {
        global.Ably = Ably;
        echo = new Echo({
            broadcaster: 'ably',
            useTls: true,
            environment: 'sandbox',
            requestTokenFn: mockAuthServer.getSignedToken
        });
    });

    afterEach(done => {
        echo.disconnect();
        echo.connector.ably.connection.once('closed', () => {
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

    test('channel member list change', done => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.here((members, err) => {
            safeAssert(() => {
                expect(members).toHaveLength(1);
                expect(members[0].clientId).toBe('sacOO7@github.com');
                expect(members[0].data).toStrictEqual({ id: 'sacOO7@github.com', name: 'sacOO7' });
            }, done, true);
        });
    });

    test('member joined', done => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.joining(member => {
            safeAssert(() => {
                expect(member.clientId).toBe('sacOO7@github.com');
                expect(member.data).toStrictEqual({ id: 'sacOO7@github.com', name: 'sacOO7' });
            }, done, true);
        })
    })

    test('member left', done => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.leaving(member => {
            safeAssert(() => {
                expect(member.clientId).toBe('sacOO7@github.com');
                expect(member.data).toStrictEqual({ name: 'sacOO7 leaving the channel' });
            }, done, true);
        });
        presenceChannel.joining(()=> presenceChannel.leave({name: 'sacOO7 leaving the channel'}));
    })
});