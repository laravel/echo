# Release Notes

## [Unreleased](https://github.com/laravel/echo/compare/v1.15.3...master)

## [v1.15.3](https://github.com/laravel/echo/compare/v1.15.2...v1.15.3) - 2023-08-29

- Export `Connector` and `EventFormatter` to provide full extensibility by [@slavarazum](https://github.com/slavarazum) in https://github.com/laravel/echo/pull/383

## [v1.15.2](https://github.com/laravel/echo/compare/v1.15.1...v1.15.2) - 2023-07-11

- Fix broken Typescript presence channel interface "whisper" method by [@DellanX](https://github.com/DellanX) in https://github.com/laravel/echo/pull/377
- Fix TS error in EventFormatter for projects using TS5 by [@SanderMuller](https://github.com/SanderMuller) in https://github.com/laravel/echo/pull/381

## [v1.15.1](https://github.com/laravel/echo/compare/v1.15.0...v1.15.1) - 2023-04-26

- Fix broken Typescript presence channel interface "whisper" method by @DellanX in https://github.com/laravel/echo/pull/377

## [v1.15.0](https://github.com/laravel/echo/compare/v1.14.2...v1.15.0) - 2023-01-17

### Added

- Leave from all channels by @k0mar12 in https://github.com/laravel/echo/pull/365
- Add an `encrypedPrivateChannel` function to the NullConnector. by @luniki in https://github.com/laravel/echo/pull/369
- Add a `listenToAll` function to the NullConnector. by @luniki in https://github.com/laravel/echo/pull/368

## [v1.14.2](https://github.com/laravel/echo/compare/v1.14.1...v1.14.2) - 2022-11-22

### Fixed

- Fix node type issue by @timacdonald in https://github.com/laravel/echo/pull/361

## [v1.14.1](https://github.com/laravel/echo/compare/v1.14.0...v1.14.1) - 2022-10-25

### Fixed

- Instantiate pusher using Pusher class from option by @chhornponleu in https://github.com/laravel/echo/pull/359

## [v1.14.0](https://github.com/laravel/echo/compare/v1.13.1...v1.14.0) - 2022-08-30

### Added

- Bearer token Authorization support by @parallels999 in https://github.com/laravel/echo/pull/353

## [v1.13.1](https://github.com/laravel/echo/compare/v1.13.0...v1.13.1) - 2022-08-02

### Changed

- Also leave Pusher private encrypted channel by @daannet in https://github.com/laravel/echo/pull/349

## [v1.13.0](https://github.com/laravel/echo/compare/v1.12.1...v1.13.0) - 2022-07-26

### Added

- Adds Turbo Interceptor to add X-Socket-Id header on Turbo requests by @tonysm in https://github.com/laravel/echo/pull/348

## [v1.12.1](https://github.com/laravel/echo/compare/v1.12.0...v1.12.1) - 2022-07-13

### Fixed

- Fix IIFE build by @timacdonald in https://github.com/laravel/echo/pull/344

## [v1.12.0](https://github.com/laravel/echo/compare/v1.11.7...v1.12.0) - 2022-06-21

### Added

- User Authentication by @rennokki in https://github.com/laravel/echo/pull/340

## [v1.11.7](https://github.com/laravel/echo/compare/v1.11.6...v1.11.7) - 2022-04-21

No significant changes.

## [v1.11.6](https://github.com/laravel/echo/compare/v1.11.5...v1.11.6) - 2022-04-21

No significant changes.

## [v1.11.5](https://github.com/laravel/echo/compare/v1.11.4...v1.11.5) - 2022-04-12

### Changed

- Add Channel, PresenceChannel class to typescript definition exports by @steve3d in https://github.com/laravel/echo/pull/333

## [v1.11.4](https://github.com/laravel/echo/compare/v1.11.3...v1.11.4) - 2022-03-15

### Changed

- Bump packages versions by @lucasmichot in https://github.com/laravel/echo/pull/331

## [v1.11.3 (2021-10-26)](https://github.com/laravel/echo/compare/v1.11.2...v1.11.3)

### Fixed

- Fix types in connector.ts ([#327](https://github.com/laravel/echo/pull/327))

## [v1.11.2 (2021-08-31)](https://github.com/laravel/echo/compare/v1.11.1...v1.11.2)

### Changed

- Package build

## [v1.11.1 (2021-08-03)](https://github.com/laravel/echo/compare/v1.11.0...v1.11.1)

### Changed

- Extend presence channel by channel class ([#318](https://github.com/laravel/echo/pull/318))

## [v1.11.0 (2021-06-17)](https://github.com/laravel/echo/compare/v1.10.0...v1.11.0)

### Added

- Add `listenToAll` and `stopListeningToAll` ([#315](https://github.com/laravel/echo/pull/315))

## [v1.10.0 (2020-12-19)](https://github.com/laravel/echo/compare/v1.9.0...v1.10.0)

### Added

- Add optional callback argument to `stopListening()` ([#292](https://github.com/laravel/echo/pull/292))

## [v1.9.0 (2020-10-13)](https://github.com/laravel/echo/compare/v1.8.1...v1.9.0)

### Added

- Register subscription succeeded callbacks ([#288](https://github.com/laravel/echo/pull/288))

## [v1.8.1 (2020-07-31)](https://github.com/laravel/echo/compare/v1.8.0...v1.8.1)

### Added

- Implement error handling with support for Pusher ([#284](https://github.com/laravel/echo/pull/284))

## [v1.8.0 (2020-05-16)](https://github.com/laravel/echo/compare/v1.7.0...v1.8.0)

### Fixed

- IE11 fix for dist/echo.js not being transpiled to ES5 ([#270](https://github.com/laravel/echo/pull/270))

## [v1.7.0 (2020-04-03)](https://github.com/laravel/echo/compare/v1.6.1...v1.7.0)

### Added

- Add pusher private-encrypted ([#264](https://github.com/laravel/echo/pull/264))

## [v1.6.1 (2019-10-01)](https://github.com/laravel/echo/compare/v1.6.0...v1.6.1)

### Fixed

- Change check for 'querySelector' method for browser compatibility ([#253](https://github.com/laravel/echo/pull/253))

## [v1.6.0 (2019-09-24)](https://github.com/laravel/echo/compare/v1.5.4...v1.6.0)

### Added

- Add `stopWhisper` method to channel ([#243](https://github.com/laravel/echo/pull/243))
- Add option `this.options.withoutInterceptors` ([#248](https://github.com/laravel/echo/pull/248))
- Add support for custom connectors ([#247](https://github.com/laravel/echo/pull/247))

### Fixed

- Check for `querySelector` ([#251](https://github.com/laravel/echo/pull/251))

## [v1.5.4 (2019-06-14)](https://github.com/laravel/echo/compare/v1.5.3...v1.5.4)

### Fixed

- Ensure passed param wins over global ([#235](https://github.com/laravel/echo/pull/235))

## [v1.5.3 (2019-02-14)](https://github.com/laravel/echo/compare/v1.5.2...v1.5.3)

### Fixed

- Add reference to TS declaration file ([#222](https://github.com/laravel/echo/pull/222))
- Add missing method to Echo instance ([fd3b65b](https://github.com/laravel/echo/commit/fd3b65b5be2950e550e1e18a8d29451bdd66ce7f))

## [v1.5.2 (2018-12-12)](https://github.com/laravel/echo/compare/v1.5.1...v1.5.2)

### Added

- Add iife output to dist ([#214](https://github.com/laravel/echo/pull/214))
- Add leaveOne method to connectors ([#216](https://github.com/laravel/echo/pull/216), [9809405](https://github.com/laravel/echo/commit/9809405f63c318cbd8fef3e1b35159962a848f69))

## [v1.5.1 (2018-12-05)](https://github.com/laravel/echo/compare/v1.5.0...v1.5.1)

### Added

- Add commonjs output to distribution ([#212](https://github.com/laravel/echo/pull/212))

## [v1.5.0 (2018-12-01)](https://github.com/laravel/echo/compare/v1.4.1...v1.5.0)

### Changed

- General maintenance, code styling, and add `stopListening()` for socket.io ([#210](https://github.com/laravel/echo/pull/210))
