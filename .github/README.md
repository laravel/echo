## Introduction

- This repository is a fork of https://github.com/laravel/echo. 
- It adheres to public interface methods from base repo.
- It will be synced regularly with base repo. to make sure all the code is up to date.
- Ably-specific implementation is added to support native [ably-js](https://github.com/ably/ably-js).

## Installation 
- `npm install @ably/laravel-echo ably`

Once Echo is installed, you are ready to create a fresh Echo instance in your application's JavaScript. A great place to do this is at the bottom of the `resources/js/bootstrap.js` file that is included with the Laravel framework. By default, an example Echo configuration is already included in this file; however, the default configuration in the `bootstrap.js` file is intended for Pusher. You may copy the configuration below to transition your configuration to Ably.

```js
import Echo from 'laravel-echo';
import * as Ably from 'ably';

window.Ably = Ably;
window.Echo = new Echo({
    broadcaster: 'ably',
});

window.Echo.connector.ably.connection.on(stateChange => {
    if (stateChange.current === 'connected') {
        console.log('connected to ably server');
    }
});
```
You can set custom [clientOptions](https://ably.com/docs/api/realtime-sdk?lang=javascript#client-options) when creating an `Echo` instance.

```
    broadcaster: 'ably',
    authEndpoint: 'http://www.localhost:8000/broadcasting/auth'
      // Additional ably specific options - https://ably.com/docs/api/realtime-sdk?lang=javascript#client-options  
    realtimeHost: 'realtime.ably.com',
    restHost: 'rest.ably.com',
    port: '80',
    echoMessages: true // By default self-echo for published message is false
```
Once you have uncommented and adjusted the Echo configuration according to your needs, you may compile your application's assets:

```shell
npm run dev
```


## Official Documentation
- More documentation for Echo can be found on the [Laravel website](https://laravel.com/docs/broadcasting).

## Contributing
- Make sure all of the public interfacing methods on `Echo` and `Channel` object are kept intact irrespective of internal implementation.
- Follow the below steps for modifying the code.
1. Fork it.
2. Create your feature branch (`git checkout -b my-new-feature`).
3. Commit your changes (`git commit -am 'Add some feature'`).
4. Ensure you have added suitable tests and the test suite is passing (run `vendor/bin/phpunit`)
4. Push to the branch (`git push origin my-new-feature`).
5. Create a new Pull Request.


## Release Process
This library uses [semantic versioning](http://semver.org/). For each release, the following needs to be done:

1. Create a new branch for the release, named like `release/1.2.4` (where `1.2.4` is what you're releasing, being the new version)
2. Run [`github_changelog_generator`](https://github.com/skywinder/Github-Changelog-Generator) to automate the update of the [CHANGELOG-ABLY.md](./CHANGELOG-ABLY.md). Once the `CHANGELOG-ABLY` update has completed, manually change the `Unreleased` heading and link with the current version number such as `1.2.4`. Also ensure that the `Full Changelog` link points to the new version tag instead of the `HEAD`.
3. Commit generated [CHANGELOG-ABLY.md](./CHANGELOG-ABLY.md) file.
4. Make a PR against `main`.
5. Once the PR is approved, merge it into `main`.
6. Add a tag and push it to origin - e.g.: `git tag v1.2.4 && git push origin v1.2.4`.
7. Publish npm package on npmjs.com.

## Note 
- Current `README` is newly created and located under `.github/README.md` to avoid syncing conflicts with root `README`.
- `CHANGELOG-ABLY.md` will be used for commiting changelog instead of `CHANGELOG.md` to avoid conflicts while syncing.
