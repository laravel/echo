export const isNullOrUndefined = (obj) => obj == null || obj === undefined;
export const isEmptyString = (stringToCheck, ignoreSpaces = true) => (ignoreSpaces ? stringToCheck.trim() : stringToCheck) === '';
export const isNullOrUndefinedOrEmpty = (obj) => obj == null || obj === undefined || isEmptyString(obj);

/**
 * @throws Exception if parsing error
 */
export const parseJwt = (jwtToken: string): { header: any, payload: any } => {
    // Get Token Header
    const base64HeaderUrl = jwtToken.split('.')[0];
    const base64Header = base64HeaderUrl.replace('-', '+').replace('_', '/');
    const header = JSON.parse(toText(base64Header));
    // Get Token payload
    const base64Url = jwtToken.split('.')[1];
    const base64 = base64Url.replace('-', '+').replace('_', '/');
    const payload = JSON.parse(toText(base64));
    return { header, payload };
}

export const toTokenDetails = (jwtToken: string) => {
    const { payload } = parseJwt(jwtToken);
    return {
        // capability: parsedJwt['x-ably-capability'], // RSA4f - tokenDetails size should't exceed 128kb
        clientId: payload['x-ably-clientId'],
        expires: payload.exp * 1000, // Convert Seconds to ms
        issued: payload.iat * 1000,
        token: jwtToken
    };
}

const isBrowser = typeof window === 'object';
const isNativescript = typeof global === 'object' && global.isNativescript;

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

function createXHR() {
    var result = new XMLHttpRequest();
    if ('withCredentials' in result) return result;// @ts-ignore
    if (typeof XDomainRequest !== 'undefined') { // @ts-ignore
        var xdr = new XDomainRequest(); /* Use IE-specific "CORS" code with XDR */
        xdr.isXDR = true;
        return xdr;
    }
    return null;
}

function schemeMatchesCurrent(scheme) {
    return scheme === window.location.protocol.slice(0, -1);
}

export function httpReqFunction() {
    if (isNativescript) {
        return function (options, callback) {
            var http = require('http');
            var uri = options.scheme + '://' + options.host + ':' + options.port + options.path;

            http
                .request({
                    url: uri,
                    method: options.method || 'GET',
                    timeout: 10000,
                    headers: options.headers,
                    content: options.body,
                })
                .then(function (results) {
                    callback(null, results.content.toString());
                })
            ['catch'](function (err) {
                callback(err);
            });
        };
    } else if (isBrowser) {
        return function (options, callback) {
            var xhr = createXHR();
            var uri;

            uri = options.scheme + '://' + options.host + ':' + options.port + options.path;

            if (xhr.isXDR && !schemeMatchesCurrent(options.scheme)) {
                /* Can't use XDR for cross-scheme. For some requests could just force
                 * the same scheme and be done with it, but not for authenticated
                 * requests to ably, can't use basic auth for non-tls endpoints.
                 * Luckily ably can handle jsonp, so just use the ably Http method,
                 * which will use the jsonp transport. Can't just do this all the time
                 * as the local express webserver serves files statically, so can't do
                 * jsonp. */
                if (options.method === 'DELETE') {
                    /* Ignore DELETEs -- can't be done with jsonp at the moment, and
                     * simulation apps self-delete after a while */
                    callback();
                } else {// @ts-ignore
                    new Ably.Rest.Platform.Http().doUri( 
                        options.method,
                        null,
                        uri,
                        options.headers,
                        options.body,
                        options.paramsIfNoHeaders || {},
                        callback
                    );
                }
                return;
            }

            xhr.open(options.method, uri);
            if (options.headers && !xhr.isXDR) {
                for (var h in options.headers) if (h !== 'Content-Length') xhr.setRequestHeader(h, options.headers[h]);
            }
            xhr.onerror = function (err) {
                callback(err);
            };
            if ('onreadystatechange' in xhr) {
                /* XHR */
                xhr.onreadystatechange = function () {
                    if (xhr.readyState == 4) {
                        if (xhr.status >= 300) {
                            callback('HTTP request failed ' + xhr.status);
                            return;
                        }
                        callback(null, xhr.responseText);
                    }
                };
            } else {
                /* XDR */
                xhr.onload = function () {
                    if (xhr.status >= 300) {
                        callback('HTTP request failed ' + xhr.status);
                        return;
                    }
                    callback(null, xhr.responseText);
                };
            }
            xhr.send(options.body);
        };
    } else {
        var http = require('http'),
            https = require('https');

        return function (options, callback) {
            var body = options.body;
            delete options.body;
            var response = '';
            var request = (options.scheme == 'http' ? http : https).request(options, function (res) {
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    response += chunk;
                });
                res.on('end', function () {
                    if (res.statusCode >= 300) {
                        callback('Invalid HTTP request: ' + response + '; statusCode = ' + res.statusCode);
                    } else {
                        callback(null, response);
                    }
                });
            });
            request.on('error', function (err) {
                callback(err);
            });
            request.end(body);
        };
    }
}
