import { beforeChannelAttach } from './attach';
import { toTokenDetails } from './utils';
import { SequentialAuthTokenRequestExecuter } from './token-request';
import { AblyChannel } from '../ably-channel';

export class AblyAuth {

    // TODO - Can be updated with request throttle, to send multiple request payload under single request
    authRequestExecuter: SequentialAuthTokenRequestExecuter;

    authOptions = {
        queryTime: true,
        useTokenAuth: true,
        authCallback: async (_, callback) => { // get token from tokenParams
            try {
                const jwtToken = await this.authRequestExecuter.request(null); // Replace this by network request to PHP server
                const tokenDetails = toTokenDetails(jwtToken);
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

    enableAuthorizeBeforeChannelAttach = (ablyClient) => {
        beforeChannelAttach(ablyClient, (realtimeChannel, errorCallback) => {
            const channelName = realtimeChannel.name;
            if (channelName.startsWith("public:")) {
                errorCallback(null);
                return;
            }

            // Use cached token if has channel capability and is not expired
            const token = ablyClient.auth.tokenDetails;
            if (token) {
                const tokenHasChannelCapability = token.capability.includes(`${channelName}"`);
                if (tokenHasChannelCapability && token.expires >= Date.now()) { // TODO : Replace with server time
                    errorCallback(null);
                    return;
                }
            }

            // explicitly request token for given channel name
            this.authRequestExecuter.request(channelName).then(jwtToken => { // get upgraded token with channel access
                ablyClient.auth.authorize(null, { ...this.authOptions, token: toTokenDetails(jwtToken) }, (err, tokenDetails) => {
                    if (err) {
                        errorCallback(err);
                    } else {
                        errorCallback(null);
                    }
                });
            }).catch(err => errorCallback(err)); // TODO : Check if errors/exceptions are properly handled
        });
    }

    onChannelFailed = (ablyChannel: AblyChannel) => stateChange => {
        if (stateChange.reason?.code == 40160) { // channel capability rejected https://help.ably.io/error/40160
            this.handleChannelAuthError(ablyChannel);
        }
    }

    handleChannelAuthError = (ablyChannel: AblyChannel) => {
        const channelName = ablyChannel.name;
        this.authRequestExecuter.request(channelName).then(jwtToken => { // get upgraded token with channel access
            ablyChannel.ably.auth.authorize(null, { ...this.authOptions, token: toTokenDetails(jwtToken) }, (err, _tokenDetails) => {
                if (err) {
                    ablyChannel._publishErrors(err);
                } else {
                    ablyChannel.channel.attach();
                }
            });
        }).catch(err => ablyChannel._publishErrors(err));
    }
}

