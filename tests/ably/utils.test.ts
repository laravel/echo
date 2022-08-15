import { parseJwt, toTokenDetails } from '../../src/channel/ably/utils';

describe('Utils', () => {
    test('should parse JWT properly', () => {
        const token =
            'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6ImFiY2QifQ.eyJpYXQiOjE2NTQ2MzQyMTIsImV4cCI6MTY1NDYzNzgxMiwieC1hYmx5LWNsaWVudElkIjoidXNlcjEyMyIsIngtYWJseS1jYXBhYmlsaXR5Ijoie1wicHVibGljOipcIjpbXCJzdWJzY3JpYmVcIixcImhpc3RvcnlcIixcImNoYW5uZWwtbWV0YWRhdGFcIl19In0.GenM5EyUeJvgAGBD_EG-89FueNKWtyRZyi61s9G2Bs4';
        const expectedHeader = {
            alg: 'HS256',
            kid: 'abcd',
            typ: 'JWT',
        };
        const expectedPayload = {
            iat: 1654634212,
            exp: 1654637812,
            'x-ably-clientId': 'user123',
            'x-ably-capability': '{"public:*":["subscribe","history","channel-metadata"]}',
        };

        expect(parseJwt(token).header).toStrictEqual(expectedHeader);
        expect(parseJwt(token).payload).toStrictEqual(expectedPayload);
    });

    test('should convert to tokenDetails', () => {
        const token =
            'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6ImFiY2QifQ.eyJpYXQiOjE2NTQ2MzQyMTIsImV4cCI6MTY1NDYzNzgxMiwieC1hYmx5LWNsaWVudElkIjoidXNlcjEyMyIsIngtYWJseS1jYXBhYmlsaXR5Ijoie1wicHVibGljOipcIjpbXCJzdWJzY3JpYmVcIixcImhpc3RvcnlcIixcImNoYW5uZWwtbWV0YWRhdGFcIl19In0.GenM5EyUeJvgAGBD_EG-89FueNKWtyRZyi61s9G2Bs4';
        const tokenDetails = toTokenDetails(token);
        expect(tokenDetails.clientId).toBe('user123');
        expect(tokenDetails.expires).toBe(1654637812000);
        expect(tokenDetails.issued).toBe(1654634212000);
        expect(tokenDetails.token).toBe(token);
    });
});
