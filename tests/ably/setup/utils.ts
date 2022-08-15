import { httpRequestAsync } from '../../../src/channel/ably/utils';

const safeAssert = (assertions: Function, done: Function, finalAssertion = false) => {
    try {
        assertions();
        if (finalAssertion) {
            done();
        }
    } catch (err) {
        done(err);
    }
};

export const execute = (fn: Function, times: number) => {
    while (times--) {
        fn();
    }
};

export const toBase64 = (text: string) => Buffer.from(text, 'binary').toString('base64');

export const httpPostAsync = async (url: string, postData: any) => {
    postData = JSON.stringify(postData);
    let postOptions = {
        uri: url,
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Content-Length': postData.length,
        },
        body: postData,
    };
    return await httpRequestAsync(postOptions);
};

export const httpDeleteAsync = async (url: string, headers: any) => {
    let deleteOptions = {
        uri: url,
        method: 'DELETE',
        headers,
    };
    return await httpRequestAsync(deleteOptions);
};

export default safeAssert;
