import { isNullOrUndefinedOrEmpty, parseJwt } from '../../../src/channel/ably/utils';
import * as Ably from 'ably/promises';
import * as jwt from 'jsonwebtoken';

type channels = Array<string>;

export class MockAuthServer {
    keyName: string;
    keySecret: string;
    ablyClient: Ably.Rest;
    clientId = 'sacOO7@github.com';
    userInfo = { id: 'sacOO7@github.com', name: 'sacOO7' };

    shortLived: channels;
    banned: channels;

    constructor(apiKey: string, environment = 'sandbox') {
        const keys = apiKey.split(':');
        this.keyName = keys[0];
        this.keySecret = keys[1];
        this.ablyClient = new Ably.Rest({ key: apiKey, environment });
    }

    broadcast = async (channelName: string, eventName: string, message: string) => {
        await this.ablyClient.channels.get(channelName).publish(eventName, message);
    };

    tokenInvalidOrExpired = (serverTime, token) => {
        const tokenInvalid = false;
        const { payload } = parseJwt(token);
        return tokenInvalid || payload.exp * 1000 <= serverTime;
    };

    getSignedToken = async (channelName: any = null, token: any = null) => {
        const header = {
            typ: 'JWT',
            alg: 'HS256',
            kid: this.keyName,
        };
        // Set capabilities for public channel as per https://ably.com/docs/core-features/authentication#capability-operations
        let capabilities = { 'public:*': ['subscribe', 'history', 'channel-metadata'] };
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
            capabilities[channelName] = ['*'];
        }
        let claims = {
            iat,
            exp,
            'x-ably-clientId': this.clientId,
            'x-ably-capability': JSON.stringify(capabilities),
        };
        claims = this.validateShortLivedOrBannedChannels(channelName, claims);
        const response = { token: jwt.sign(claims, this.keySecret, { header }) };
        if (channelName && this.isPresenceChannel(channelName)) {
            return { ...response, info: this.userInfo };
        }
        return response;
    };

    isPresenceChannel = (channelName) => channelName.startsWith('presence:');

    setAuthExceptions = (shortLived: channels = [], banned: channels = []) => {
        this.shortLived = shortLived;
        this.banned = banned;
    };

    validateShortLivedOrBannedChannels = (channelName: string, claims: any) => {
        if (this.shortLived?.includes(channelName)) {
            const exp = claims.iat + 3; // if channel is shortlived, token expiry set to 3 seconds
            return { ...claims, exp };
        }
        if (this.banned?.includes(channelName)) {
            throw new Error(`User can't be authenticated for ${channelName}`);
        }
        return claims;
    };
}
