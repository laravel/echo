import { isNullOrUndefinedOrEmpty, parseJwt } from '../../../src/channel/ably/utils';
import * as Ably from "ably/promises";
import * as jwt from "jsonwebtoken";

export class MockAuthServer {
    keyName: string;
    keySecret: string;
    ablyClient: Ably.Rest;
    clientId = 'sacOO7@github.com'

    constructor(apiKey: string) {
        const keys = apiKey.split(':');
        this.keyName = keys[0];
        this.keySecret = keys[1];
        this.ablyClient = new Ably.Rest(apiKey);
    }

    tokenInvalidOrExpired = (serverTime, token) => {
        const tokenInvalid = false;
        const { payload } = parseJwt(token);
        return tokenInvalid || payload.exp * 1000 <= serverTime;
    };

    getSignedToken = async (channelName = null, token = null) => {
        const header = {
            "typ": "JWT",
            "alg": "HS256",
            "kid": this.keyName
        }
        // Set capabilities for public channel as per https://ably.com/docs/core-features/authentication#capability-operations
        let capabilities = { "public:*": ["subscribe", "history", "channel-metadata"] };
        let iat = 0;
        let exp = 0;
        let serverTime = await this.ablyClient.time();
        if (!isNullOrUndefinedOrEmpty(token) && !this.tokenInvalidOrExpired(serverTime, token)) {
            const { payload } = parseJwt(token);
            iat = payload.iat;
            exp = payload.exp;
            capabilities = JSON.parse(payload['x-ably-capability']);
        } else {
            iat = Math.round(serverTime / 1000);
            exp = iat + 60; /* time of expiration in seconds */
        }
        if (!isNullOrUndefinedOrEmpty(channelName)) {
            capabilities[channelName] = ["*"]
        }
        const claims = {
            iat,
            exp,
            "x-ably-clientId": this.clientId,
            "x-ably-capability": JSON.stringify(capabilities)
        }
        return jwt.sign(claims, this.keySecret, { header });
    }
}

