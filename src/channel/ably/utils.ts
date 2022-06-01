export const isNullOrUndefined = (obj) => obj == null || obj === undefined;
export let isEmptyString = (stringToCheck, ignoreSpaces = true) => (ignoreSpaces ? stringToCheck.trim() : stringToCheck) === '';
export const isNullOrUndefinedOrEmpty = (obj) => obj == null || obj === undefined || isEmptyString(obj);

export const parseJwt = (token) => {
    try {
        // Get Token Header
        const base64HeaderUrl = token.split('.')[0];
        const base64Header = base64HeaderUrl.replace('-', '+').replace('_', '/');
        const headerData = JSON.parse(asciiToBase64(base64Header));

        // Get Token payload and date's
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace('-', '+').replace('_', '/');
        const dataJWT = JSON.parse(asciiToBase64(base64));
        dataJWT.header = headerData;

        // TODO: add expiration at check ...

        return dataJWT;
    } catch (err) {
        return false;
    }
}

export const toTokenDetails = (jwtTokenString) => {
    const parsedJwt = parseJwt(jwtTokenString);
    return {
        capability: parsedJwt['x-ably-capability'],
        clientId: parsedJwt['x-ably-clientId'],
        expires: parsedJwt.exp * 1000, // Convert Seconds to ms
        issued: parsedJwt.iat * 1000,
        token: jwtTokenString
    }
}

let base64toAscii = (text: string) => {
    return Buffer.from(text, 'binary').toString('base64');
};

let asciiToBase64 = (base64: string) => {
    return Buffer.from(base64, 'base64').toString('binary');
};

if (window) {
    base64toAscii = btoa;
    asciiToBase64 = atob;
}