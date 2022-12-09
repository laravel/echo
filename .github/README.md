## Introduction
This repository is a fork of https://github.com/laravel/echo. It adheres to public interface methods from base repository. It will be synced regularly with the base repository to make sure all the code is up to date.
Ably-specific implementation is added to support native [ably-js](https://github.com/ably/ably-js).

## Installation 
 Install `@ably/laravel-echo` (wrapper for pluggable lib) and latest version of `ably` (pluggable lib) using npm.

```bash
npm install @ably/laravel-echo ably
```

Once Echo is installed, you are ready to create a fresh Echo instance in your application's JavaScript. A great place to do this is at the bottom of the `resources/js/bootstrap.js` file that is included with the Laravel framework. By default, an example Echo configuration is already included in this file; however, the default configuration in the `bootstrap.js` file is intended for Pusher. You may copy the configuration below to transition your configuration to Ably.

```js
import Echo from '@ably/laravel-echo';
import * as Ably from 'ably';

window.Ably = Ably; // make globally accessible to Echo
window.Echo = new Echo({
    broadcaster: 'ably',
});

window.Echo.connector.ably.connection.on(stateChange => {
    if (stateChange.current === 'connected') {
        console.log('connected to ably server');
    }
});
```
You can set additional ably-js [clientOptions](https://ably.com/docs/api/realtime-sdk?lang=javascript#client-options) when creating an `Echo` instance.

```
    broadcaster: 'ably',
    authEndpoint: 'http://www.localhost:8000/broadcasting/auth', // absolute or relative url to laravel-server 
    realtimeHost: 'realtime.ably.com',
    restHost: 'rest.ably.com',
    port: '80',
    echoMessages: true // By default self-echo for published message is false
```
Once you have uncommented and adjusted the Echo configuration according to your needs, you may compile your application's assets:

```shell
npm run dev
```

## Leaving the channel
- Make sure to use following syntax while using `leaveChannel` method on `Echo`.
```
 // public channel
Echo.channel('channel1');
Echo.leaveChannel("public:channel1");
// private channel
Echo.private('channel2'); 
Echo.leaveChannel("private:channel2")
// presence channel
Echo.join('channel3'); 
Echo.leaveChannel("presence:channel3")
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
2. Update the `LIB_VERSION` in `src/connector/ably-connector.ts`.
3. Run `npm version {NEW_VERSION_NUMBER} --no-git-tag-version`
4. Run [`github_changelog_generator`](https://github.com/skywinder/Github-Changelog-Generator) to automate the update of the [CHANGELOG-ABLY.md](../CHANGELOG-ABLY.md). Once the `CHANGELOG-ABLY` update has completed, manually change the `Unreleased` heading and link with the current version number such as `1.2.4`. Also ensure that the `Full Changelog` link points to the new version tag instead of the `HEAD`.
5. Commit generated [CHANGELOG-ABLY.md](../CHANGELOG-ABLY.md) file at root.
6. Make a PR against `main`.
7. Once the PR is approved, merge it into `main`.
8. Add a tag and push it to origin - e.g.: `git tag ably-echo-1.2.4
 && git push origin ably-echo-1.2.4`.
9. Publish npm package on npmjs.com.
10. Visit https://github.com/ably-forks/laravel-echo/tags and add release notes to the release (generally you can just copy the notes you added to the CHANGELOG).
11. Update the [Ably Changelog](https://changelog.ably.com/) (via [headwayapp](https://headwayapp.co/)) with these changes (again, you can just copy the notes you added to the CHANGELOG).

## Note 
- Current `README` is newly created and located under `.github/README.md`.
- `CHANGELOG-ABLY.md` will be used for commiting changelog instead of `CHANGELOG.md`.
- This is mainly to avoid syncing conflicts with base repository.
