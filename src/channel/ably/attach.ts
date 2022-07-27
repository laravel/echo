import { isNullOrUndefined } from './utils';

let channelAttachAuthorized = false;

/**
 * Modifies existing channel attach with custom authz implementation
 */
export const beforeChannelAttach = (ablyClient, authorize: Function) => {
    const dummyRealtimeChannel = ablyClient.channels.get("dummy");
    if (channelAttachAuthorized) { //Only once all ably instance
        return;
    }
    const internalAttach = dummyRealtimeChannel.__proto__._attach; // get parent class method inferred from object, store it in temp. variable
    if (isNullOrUndefined(internalAttach)) {
        console.warn("channel internal attach function not found, please check for right library version")
        return;
    }
    function customInternalAttach(forceReattach, attachReason, errCallback) {// Define new function that needs to be added
        if (this.state === 'attached' || this.authorizing) {
            return;
        }
        this.authorizing = true;
        const bindedInternalAttach = internalAttach.bind(this); // bind object instance at runtime
        // custom logic before attach
        authorize(this, (error) => {
            this.authorizing = false;
            if (error) {
                errCallback(error);
                return;
            } else {
                bindedInternalAttach(forceReattach, attachReason, errCallback);// call internal function here
            }
        })
    }
    dummyRealtimeChannel.__proto__._attach = customInternalAttach; // add updated extension method to parent class, auto binded
    channelAttachAuthorized = true;
}
