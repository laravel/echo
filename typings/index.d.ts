// libs required to be set globally before initializing echo instance (currently used in tests)
declare global {
    var Ably: any;
    var Pusher: any;
    var io: any;
    var Vue: any;
    var axios: any;
    var jQuery: any;
    var Turbo: any;
}
export {};
