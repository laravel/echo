import { httpDeleteAsync, httpPostAsync, toBase64 } from './utils';

let sandboxUrl = 'https://sandbox-rest.ably.io/apps';

const creatNewApp = async () => {
    let body = {
        keys: [{}],
        namespaces: [],
    };
    const res: {
        appId: string;
        keys: { keyStr: string }[];
    } = await httpPostAsync(sandboxUrl, body);
    return res;
};

const deleteApp = async (app) => {
    let authKey = app.keys[0].keyStr;
    const headers = { Authorization: 'Basic ' + toBase64(authKey) };
    return await httpDeleteAsync(`${sandboxUrl}/${app.appId}`, headers);
};

export { creatNewApp as setup, deleteApp as tearDown };
