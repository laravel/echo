export function convertDeprecatedOptions(options: Record<any, any>) {
  if (typeof options.authorizer !== 'undefined') {
    // We cannot use the channelAuthorization.customHandler if the authorizer is set,
    // sync the authorizer is build inside the Pusher (https://github.com/pusher/pusher-js/blob/37b057c45c403af27c79303123344c42f6da6a25/src/core/config.ts#L167)
    // and require the Pusher instance to be passed to the authorizer.

    // Convert all options to the deprecated format.
    options.authEndpoint ||= options.channelAuthorization.endpoint;
    options.authTransport ||= options.channelAuthorization.transport;
    options.auth ||= {};
    options.auth.headers ||= options.channelAuthorization.headers || {};
    options.auth.params ||= options.channelAuthorization.params || {};

    delete options.channelAuthorization;

    return;
  }

  // Backward compatibility for the authEndpoint option.
  // https://github.com/pusher/pusher-js/blob/37b057c45c403af27c79303123344c42f6da6a25/src/core/config.ts#L163
  if (typeof options.authEndpoint !== 'undefined') {
    options.channelAuthorization.endpoint = options.authEndpoint;
    options.authEndpoint = null;
  }

  // Backward compatibility for the authTransport option.
  // https://github.com/pusher/pusher-js/blob/37b057c45c403af27c79303123344c42f6da6a25/src/core/config.ts#L158
  if (typeof options.authTransport !== 'undefined') {
    options.channelAuthorization.transport = options.authTransport;
    options.authTransport = null;
  }

  // Backward compatibility for the auth option.
  // https://github.com/pusher/pusher-js/blob/37b057c45c403af27c79303123344c42f6da6a25/src/core/config.ts#L161
  if (typeof options.auth !== 'undefined') {
    options.channelAuthorization.headers = options.auth.headers || {};
    options.channelAuthorization.params = options.auth.params || {};
    options.auth = null;
  }

  return options;
}

export function setAuthOptions(options: Record<any, any>) {
  const channelAuthKey = Object.prototype.hasOwnProperty.call(options, 'channelAuthorization')
    ? 'channelAuthorization'
    : 'auth';

  const csrfToken = this.csrfToken();
  if (csrfToken) {
    options[channelAuthKey].headers['X-CSRF-TOKEN'] = csrfToken;
    options.userAuthentication.headers['X-CSRF-TOKEN'] = csrfToken;
  }

  const bearerToken = options.bearerToken;
  if (bearerToken) {
    options[channelAuthKey].headers['Authorization'] = `Bearer ${bearerToken}`;
    options.userAuthentication.headers['Authorization'] = `Bearer ${bearerToken}`;
  }
}
