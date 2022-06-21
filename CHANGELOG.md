# Release Notes

## [Unreleased](https://github.com/laravel/echo/compare/v1.12.0...master)

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
