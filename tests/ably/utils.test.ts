import { parseJwt, toTokenDetails } from "../../src/channel/ably/utils";

describe('Utils', () => {
    test('should parse JWT properly', () => {
        const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6ImFiY2QifQ.eyJpYXQiOjE2NTQ1NDM1NjIsImV4cCI6MTY1NDU0NzE2MiwieC1hYmx5LWNsaWVudElkIjoidXNlcjEyMyIsIngtYWJseS1jYXBhYmlsaXR5Ijp7InB1YmxpYzoqIjpbInN1YnNjcmliZSIsImhpc3RvcnkiLCJjaGFubmVsLW1ldGFkYXRhIl19fQ._9S9i-tKGtpcQbAIk4h0bIs3TpKlXFi0jsUcQ-LaHZs";
        const expectedHeader = {
            "typ": "JWT",
            "alg": "HS256",
            "kid": "abcd"
        }
        const expectedPayload = {
            "iat": 1654543562,
            "exp": 1654547162,
            "x-ably-clientId": "user123",
            "x-ably-capability": {
              "public:*": [
                "subscribe",
                "history",
                "channel-metadata"
              ]
            }
          }

        expect(parseJwt(token).header).toBe(JSON.stringify(expectedHeader));
        expect(parseJwt(token).payload).toBe(JSON.stringify(expectedPayload));
      
        expect(parseJwt(token, true).header).toStrictEqual(expectedHeader);
        expect(parseJwt(token, true).payload).toStrictEqual(expectedPayload);
    })

    test('should convert to tokenDetails', () => {
        const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6ImFiY2QifQ.eyJpYXQiOjE2NTQ1NDM1NjIsImV4cCI6MTY1NDU0NzE2MiwieC1hYmx5LWNsaWVudElkIjoidXNlcjEyMyIsIngtYWJseS1jYXBhYmlsaXR5Ijp7InB1YmxpYzoqIjpbInN1YnNjcmliZSIsImhpc3RvcnkiLCJjaGFubmVsLW1ldGFkYXRhIl19fQ._9S9i-tKGtpcQbAIk4h0bIs3TpKlXFi0jsUcQ-LaHZs";
        const tokenDetails = toTokenDetails(token);
        expect(tokenDetails.clientId).toBe('user123');
        expect(tokenDetails.expires).toBe(1654547162000);
        expect(tokenDetails.issued).toBe(1654543562000);
        expect(tokenDetails.token).toBe(token);
    })
});