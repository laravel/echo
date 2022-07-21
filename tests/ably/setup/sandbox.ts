import got from 'got';

let sandboxUrl = 'https://sandbox-rest.ably.io/apps';

const creatNewApp = async () => {
    var body = {
        "keys": [{}],
        "namespaces": []
    };
    const res: {
        appId: string,
        keys: { keyStr: string}[],
      } = await got.post(sandboxUrl, { json: body }).json();

    return res;  
}

const deleteApp = async (app) => {
    var authKey = app.keys[0].keyStr;
    return got.delete(`${sandboxUrl}/${app.appId}?key=${authKey}`);
}

export { creatNewApp as setup, deleteApp as tearDown }