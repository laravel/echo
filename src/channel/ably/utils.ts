export const isNullOrUndefined = (obj) => obj == null || obj === undefined;
export let isEmptyString = (stringToCheck, ignoreSpaces = true) => (ignoreSpaces ? stringToCheck.trim() : stringToCheck) === '';
export const isNullOrUndefinedOrEmpty = (obj) => obj == null || obj === undefined || isEmptyString(obj);

export const parseJwt = (token) => {
    try {
        // Get Token Header
        const base64HeaderUrl = token.split('.')[0];
        const base64Header = base64HeaderUrl.replace('-', '+').replace('_', '/');
        const headerData = JSON.parse(atob(base64Header));

        // Get Token payload and date's
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace('-', '+').replace('_', '/');
        const dataJWT = JSON.parse(atob(base64));
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

const btoa = (text) => {
    return Buffer.from(text, 'binary').toString('base64');
};

const atob = (base64) => {
    return Buffer.from(base64, 'base64').toString('binary');
};