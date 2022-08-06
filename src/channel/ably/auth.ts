import { beforeChannelAttach } from './attach';
import { toTokenDetails, parseJwt, fullUrl, httpRequestAsync } from './utils';
import { SequentialAuthTokenRequestExecuter } from './token-request';
import { AblyChannel } from '../ably-channel';
import { AblyConnector } from '../../connector/ably-connector';
import { AblyPresenceChannel } from '../ably-presence-channel';
import { AuthOptions, ChannelStateChange, ClientOptions } from '../../../typings/ably';

export class AblyAuth {

    authEndpoint: string;
    authHeaders: any;
    authRequestExecuter: SequentialAuthTokenRequestExecuter;

    expiredAuthChannels = new Set<string>();
    setExpired = (channelName: string) => this.expiredAuthChannels.add(channelName);
    isExpired = (channelName: string) => this.expiredAuthChannels.has(channelName);
    removeExpired = (channelName: string) => this.expiredAuthChannels.delete(channelName);

    options: AuthOptions & Pick<ClientOptions, "echoMessages"> = {
        queryTime: true,
        useTokenAuth: true,
        authCallback: async (_, callback) => {
            try {
                const { token } = await this.authRequestExecuter.request(null);
                const tokenDetails = toTokenDetails(token);
                callback(null, tokenDetails);
            } catch (error) {
                callback(error, null);
            }
        },
        echoMessages: false // https://docs.ably.io/client-lib-development-guide/features/#TO3h
    }

    requestToken = async (channelName: string, existingToken: string) => {
        let postData = JSON.stringify({ channel_name: channelName, token: existingToken });
        let postOptions = {
            uri: this.authEndpoint,
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
                ...this.authHeaders
            },
            body: postData,
        };
        return await httpRequestAsync(postOptions);
    }

    constructor(options) {
        const { authEndpoint, auth: { headers }, token, requestTokenFn } = options;
        this.authEndpoint = fullUrl(authEndpoint);
        this.authHeaders = headers;
        this.authRequestExecuter = new SequentialAuthTokenRequestExecuter(token, requestTokenFn ?? this.requestToken);
    }

    enableAuthorizeBeforeChannelAttach = (ablyConnector: AblyConnector) => {
        const ablyClient: any = ablyConnector.ably;
        ablyClient.auth.getTimestamp(this.options.queryTime, () => void 0); // generates serverTimeOffset in the background

        beforeChannelAttach(ablyClient, (realtimeChannel, errorCallback) => {
            const channelName = realtimeChannel.name;
            if (channelName.startsWith("public:")) {
                errorCallback(null);
                return;
            }

            // Use cached token if has channel capability and is not expired
            const tokenDetails = ablyClient.auth.tokenDetails;
            if (tokenDetails && !this.isExpired(channelName)) {
                const capability = parseJwt(tokenDetails.token).payload['x-ably-capability'];
                const tokenHasChannelCapability = capability.includes(`${channelName}"`);
                if (tokenHasChannelCapability && tokenDetails.expires > ablyClient.auth.getTimestampUsingOffset()) { // checks with server time using offset, otherwise local time
                    errorCallback(null);
                    return;
                }
            }

            // explicitly request token for given channel name
            this.authRequestExecuter.request(channelName).then(({ token: jwtToken, info }) => { // get upgraded token with channel access
                const echoChannel = ablyConnector.channels[channelName];
                this.setPresenceInfo(echoChannel, info);
                ablyClient.auth.authorize(null, { ...this.options, token: toTokenDetails(jwtToken) }, (err, _tokenDetails) => {
                    if (err) {
                        errorCallback(err);
                    } else {
                        this.removeExpired(channelName);
                        errorCallback(null);
                    }
                });
            }).catch(err => errorCallback(err));
        });
    }

    onChannelFailed = (echoAblyChannel: AblyChannel) => (stateChange: ChannelStateChange) => {
        if (stateChange.reason?.code == 40160) { // channel capability rejected https://help.ably.io/error/40160
            this.handleChannelAuthError(echoAblyChannel);
        }
    }

    handleChannelAuthError = (echoAblyChannel: AblyChannel) => {
        if ((echoAblyChannel as any).skipAuth) { return }
        const channelName = echoAblyChannel.name;
        this.authRequestExecuter.request(channelName).then(({ token: jwtToken, info }) => { // get upgraded token with channel access
            this.setPresenceInfo(echoAblyChannel, info);
            echoAblyChannel.ably.auth.authorize(null, { ...this.options, token: toTokenDetails(jwtToken) as any }, (err, _tokenDetails) => {
                if (err) {
                    echoAblyChannel._alertErrorListeners(err);
                } else {
                    (echoAblyChannel as any).skipAuth = true;
                    echoAblyChannel.channel.once('attached', () => { (echoAblyChannel as any).skipAuth = false });
                    echoAblyChannel.channel.attach(echoAblyChannel._alertErrorListeners);
                }
            });
        }).catch(err => echoAblyChannel._alertErrorListeners(err));
    }

    setPresenceInfo = (echoAblyChannel: AblyChannel, info: any) => {
        if (echoAblyChannel instanceof AblyPresenceChannel) {
            echoAblyChannel.presenceData = info;
        }
    }
}
