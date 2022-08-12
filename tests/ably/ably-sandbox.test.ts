import { setup, tearDown } from './setup/sandbox';
import * as Ably from 'ably';
import safeAssert from './setup/utils';

jest.setTimeout(20000);
describe('AblySandbox', () => {
    let testApp;

    beforeAll(async () => {
        global.Ably = Ably;
        testApp = await setup();
    });

    afterAll(async () => {
        return await tearDown(testApp);
    });

    test('init with key string', () => {
        const apiKey = testApp.keys[0].keyStr;
        expect(typeof apiKey).toBe('string');
        expect(apiKey).toBeTruthy();
    });

    test('rest time should work', (done) => {
        const apiKey = testApp.keys[0].keyStr;
        const restClient = new Ably.Rest(apiKey);
        expect.assertions(1);
        restClient.time((err, time) => {
            if (err) {
                done(err);
                return;
            }
            safeAssert(() => expect(typeof time).toBe('number'), done, true);
        });
    });
});
