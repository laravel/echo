import { httpReqFunction } from "../../../src/channel/ably/utils";

let restHost = 'sandbox-rest.ably.io';
const tlsPort = 443;
const toBase64 = (text: string) => Buffer.from(text, 'binary').toString('base64');

const httpReq = httpReqFunction();

const creatNewApp = (callback) => {
    var postData = JSON.stringify({
        "keys": [{}],
        "namespaces": []
    });
    var postOptions = {
        host: restHost,
        port: tlsPort,
        path: '/apps',
        method: 'POST',
        scheme: 'https',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Content-Length': postData.length },
        body: postData,
    };

    httpReq(postOptions, function (err, res) {
        if (err) {
            callback(err);
        } else {
            if (typeof res === 'string') res = JSON.parse(res);
            var testApp = {
                accountId: res.accountId,
                appId: res.appId,
                keys: res.keys,
                cipherConfig: undefined
            };
            callback(null, testApp);
        }
    });
}

const deleteApp = (app, callback) => {
    var authKey = app.keys[0].keyStr,
        authHeader = toBase64(authKey);

    var delOptions = {
        host: restHost,
        port: tlsPort,
        method: 'DELETE',
        path: '/apps/' + app.appId,
        scheme: 'https',
        headers: { Authorization: 'Basic ' + authHeader },
    };

    httpReq(delOptions, function (err) {
        callback(err);
    });
}

export { creatNewApp as setup, deleteApp as tearDown }