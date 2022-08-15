import { isNullOrUndefined } from './utils';

let channelAttachAuthorized = false;

/**
 * Modifies existing channel attach with custom authz implementation
 */
export const beforeChannelAttach = (ablyClient, authorize: Function) => {
    const dummyRealtimeChannel = ablyClient.channels.get('dummy');
    if (channelAttachAuthorized) {
        return;
    }
    const internalAttach = dummyRealtimeChannel.__proto__._attach;
    if (isNullOrUndefined(internalAttach)) {
        console.warn('Failed to enable authorize for pre-attach, please check for right library version');
        return;
    }
    function customInternalAttach(forceReattach, attachReason, errCallback) {
        if (this.authorizing) {
            return;
        }
        this.authorizing = true;
        const bindedInternalAttach = internalAttach.bind(this);

        authorize(this, (error) => {
            this.authorizing = false;
            if (error) {
                errCallback(error);
                return;
            } else {
                bindedInternalAttach(forceReattach, attachReason, errCallback);
            }
        });
    }
    dummyRealtimeChannel.__proto__._attach = customInternalAttach;
    channelAttachAuthorized = true;
};
