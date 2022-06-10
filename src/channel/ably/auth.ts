import { beforeChannelAttach } from './attach';
import { parseJwt, toTokenDetails } from './utils';
import { SequentialAuthTokenRequestExecuter } from './token-request';
import { AblyChannel } from '../ably-channel';
import { AblyConnector } from '../../connector/ably-connector';
import { AblyPresenceChannel } from '../ably-presence-channel';

export class AblyAuth {

    // TODO - Can be updated with request throttle, to send multiple request payload under single request
    authRequestExecuter: SequentialAuthTokenRequestExecuter;

    authOptions = {
        queryTime: true,
        useTokenAuth: true,
        authCallback: async (_, callback) => { // get token from tokenParams
            try {
                const { token } = await this.authRequestExecuter.request(null); // Replace this by network request to PHP server
                const tokenDetails = toTokenDetails(token);
                callback(null, tokenDetails);
            } catch (error) {
                callback(error, null);
            }
        }
    }

    // TODO - Add default HTTP request fn
    requestToken = (channelName: string, existingToken: string) => {

    }

    constructor(options) {
        const { token, requestTokenFn } = options;
        this.authRequestExecuter = new SequentialAuthTokenRequestExecuter(token, requestTokenFn ?? this.requestToken);
    }

    enableAuthorizeBeforeChannelAttach = (ablyConnector: AblyConnector) => {
        const ablyClient: any = ablyConnector.ably;
        beforeChannelAttach(ablyClient, (realtimeChannel, errorCallback) => {
            const channelName = realtimeChannel.name;
            if (channelName.startsWith("public:")) {
                errorCallback(null);
                return;
            }

            // Use cached token if has channel capability and is not expired
            const tokenDetails = ablyClient.auth.tokenDetails;
            if (tokenDetails) {
                const capability = parseJwt(tokenDetails.token).payload['x-ably-capability'];
                const tokenHasChannelCapability = capability.includes(`${channelName}"`);
                if (tokenHasChannelCapability && tokenDetails.expires > Date.now()) { // TODO : Replace with server time
                    errorCallback(null);
                    return;
                }
            }

            // explicitly request token for given channel name
            this.authRequestExecuter.request(channelName).then(({ token: jwtToken, info }) => { // get upgraded token with channel access
                const echoChannel = ablyConnector.channels[channelName];
                this.setPresenceInfo(echoChannel, info);
                ablyClient.auth.authorize(null, { ...this.authOptions, token: toTokenDetails(jwtToken) }, (err, _tokenDetails) => {
                    if (err) {
                        errorCallback(err);
                    } else {
                        errorCallback(null);
                    }
                });
            }).catch(err => errorCallback(err)); // TODO : Check if errors/exceptions are properly handled
        });
    }

    onChannelFailed = (echoAblyChannel: AblyChannel) => stateChange => {
        if (stateChange.reason?.code == 40160) { // channel capability rejected https://help.ably.io/error/40160
            this.handleChannelAuthError(echoAblyChannel);
        }
    }

    handleChannelAuthError = (echoAblyChannel: AblyChannel) => {
        const channelName = echoAblyChannel.name;
        this.authRequestExecuter.request(channelName).then(({ token: jwtToken, info }) => { // get upgraded token with channel access
            this.setPresenceInfo(echoAblyChannel, info);
            echoAblyChannel.ably.auth.authorize(null, { ...this.authOptions, token: toTokenDetails(jwtToken) as any }, (err, _tokenDetails) => {
                if (err) {
                    echoAblyChannel._alertErrorListeners(err);
                } else {
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

