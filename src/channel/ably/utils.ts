export const isNullOrUndefined = (obj) => obj == null || obj === undefined;
export let isEmptyString = (stringToCheck, ignoreSpaces = true) => (ignoreSpaces ? stringToCheck.trim() : stringToCheck) === '';
export const isNullOrUndefinedOrEmpty = (obj) => obj == null || obj === undefined || isEmptyString(obj);

/**
 * @throws Exception if parsing error
 */
export const parseJwt = (jwtToken: string) => {
    // Get Token Header
    const base64HeaderUrl = jwtToken.split('.')[0];
    const base64Header = base64HeaderUrl.replace('-', '+').replace('_', '/');
    const headerData = JSON.parse(toText(base64Header));

    // Get Token payload and date's
    const base64Url = jwtToken.split('.')[1];
    const base64 = base64Url.replace('-', '+').replace('_', '/');
    const dataJWT = JSON.parse(toText(base64));
    dataJWT.header = headerData;

    return dataJWT;
}

export const toTokenDetails = (jwtToken: string) => {
    const parsedJwt = parseJwt(jwtToken);
    return {
        capability: parsedJwt['x-ably-capability'],
        clientId: parsedJwt['x-ably-clientId'],
        expires: parsedJwt.exp * 1000, // Convert Seconds to ms
        issued: parsedJwt.iat * 1000,
        token: jwtToken
    }
}

const isBrowser = typeof window === 'object';

let toBase64 = (text: string) => {
    if (isBrowser) {
        return btoa(text);
    }
    return Buffer.from(text, 'binary').toString('base64');
};

let toText = (base64: string) => {
    if (isBrowser) {
        return atob(base64);
    }
    return Buffer.from(base64, 'base64').toString('binary');
};