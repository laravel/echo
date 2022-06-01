import { setup, tearDown } from './setup/sandbox';
import * as Ably from 'ably';

jest.setTimeout(20000);
describe('AblySandbox', () => {
    let testApp;

    beforeAll(done => {
        setup((err, app) => {
            if (err) {
                done(err);
                return;
            }
            testApp = app;
            done();
        })
    })

    test('init with key string', () => {
        const apiKey = testApp.keys[0].keyStr;
        expect(typeof apiKey).toBe('string');
        expect(apiKey).toBeTruthy();
    })

    test('rest time should work', (done) => {
        const apiKey = testApp.keys[0].keyStr;
        const restClient = new Ably.Rest(apiKey);
        restClient.time((err, time) => {
            if (err) {
                done(err);
                return;
            }
            expect(typeof time).toBe('number');
            done()
        });
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
});