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

    test('channel member list change', (done) => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.here((members, err) => {
            safeAssert(
                () => {
                    expect(err).toBeFalsy();
                    expect(members).toHaveLength(1);
                    expect(members[0].id).toBe('sacOO7@github.com');
                    expect(members[0].name).toBe('sacOO7');
                    expect(members[0]).toStrictEqual({ id: 'sacOO7@github.com', name: 'sacOO7' });
                },
                done,
                true
            );
        });
    });

    test('member joined', (done) => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.joining((memberData, memberMetaData) => {
            safeAssert(
                () => {
                    expect(memberData).toStrictEqual({ id: 'sacOO7@github.com', name: 'sacOO7' });
                    expect(memberMetaData.clientId).toBe('sacOO7@github.com');
                },
                done,
                true
            );
        });
    });

    test('member left', (done) => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.leaving((memberData, memberMetaData) => {
            safeAssert(
                () => {
                    expect(memberData).toStrictEqual({ name: 'sacOO7 leaving the channel' });
                    expect(memberMetaData.clientId).toBe('sacOO7@github.com');
                },
                done,
                true
            );
        });
        presenceChannel.joining(() => presenceChannel.leave({ name: 'sacOO7 leaving the channel' }));
    });
});
