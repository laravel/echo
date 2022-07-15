declare let Pusher: any;
declare let Ably: any;
declare let io: any;
declare let Vue: any;
declare let axios: any;
declare let jQuery: any;

export {};
// libs required to be set globally before initializing echo instance (currently used in tests)
declare global {
    var Ably: any;
    var Pusher: any;
    var io: any;
}
