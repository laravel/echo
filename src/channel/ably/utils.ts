export const isNullOrUndefined = (obj) => obj == null || obj === undefined;
export const isEmptyString = (stringToCheck, ignoreSpaces = true) => (ignoreSpaces ? stringToCheck.trim() : stringToCheck) === '';
export const isNullOrUndefinedOrEmpty = (obj) => obj == null || obj === undefined || isEmptyString(obj);

/**
 * @throws Exception if parsing error
 */
export const parseJwt = (jwtToken: string, forceParseJson = false): { header: any, payload: any} => {
    // Get Token Header
    const base64HeaderUrl = jwtToken.split('.')[0];
    const base64Header = base64HeaderUrl.replace('-', '+').replace('_', '/');
    let header = toText(base64Header);
    if (forceParseJson) {
        header = JSON.parse(header);
    }
    // Get Token payload
    const base64Url = jwtToken.split('.')[1];
    const base64 = base64Url.replace('-', '+').replace('_', '/');
    let payload = toText(base64);
    if (forceParseJson) {
        payload = JSON.parse(payload);
    }
    return {header, payload};
}

export const toTokenDetails = (jwtToken: string) => {
    const {payload} = parseJwt(jwtToken);
    const parsedJwt = JSON.parse(payload, (key, value)=> {
        if (key === 'x-ably-capability') { // exclude capability since tokenDetails becomes bloated
            return undefined;
        }
        return value;
    });
    return {
        // capability: parsedJwt['x-ably-capability'], // RSA4f - tokenDetails size should't exceed 128kb
        clientId: parsedJwt['x-ably-clientId'],
        expires: parsedJwt.exp * 1000, // Convert Seconds to ms
        issued: parsedJwt.iat * 1000,
        token: jwtToken
    };
}

const isBrowser = typeof window === 'object';

const toBase64 = (text: string) => {
    if (isBrowser) {
        return btoa(text);
    }
    return Buffer.from(text, 'binary').toString('base64');
};

const toText = (base64: string) => {
    if (isBrowser) {
        return atob(base64);
    }
    return Buffer.from(base64, 'base64').toString('binary');
};