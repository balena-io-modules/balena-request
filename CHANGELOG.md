# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [2.1.0] - 2016-06-29

### Added

- Reject `request.stream()` with the request body if response status code doesn't determine a success.

### Changed

- Upgrade `resin-token`, which now stops validating a token with the server.

## [2.0.0] - 2015-06-18

### Added

- JSDoc documentation.
- License to every source files.
- Implement `request.stream()`.

### Changed

- Support promises.
- Improved README documentation.
- Rename `request()` to `send()`.

## [1.3.0] - 2015-06-12

### Changed

- Move `onProgress` callback to `options` object.

## [1.2.5] - 2015-05-18

### Changed

- Upgrade Resin Settings Client to v1.0.1, which defaults remoteUrl to api.resin.io.

## [1.2.4] - 2015-05-07

### Changed

- Fix pipe issue.

## [1.2.3] - 2015-04-21

### Changed

- Print node-request progress state on `DEBUG`.

### Added

- Configure Hound CI correctly.

## [1.2.2] - 2015-03-20

### Added

- Print request method on `DEBUG`.

## [1.2.1] - 2015-03-20

### Added

- Improve error logging support.
- Implement `DEBUG` flag.

## [1.2.0] - 2015-03-19

### Changed

- Make use of [resin-settings-client](https://github.com/resin-io/resin-settings-client) to retrieve `options.remoteUrl`.

## [1.1.0] - 2015-03-18

### Removed

- `options.token` option is now obsolete, as the token is fetched automatically with [resin-token](https://github.com/resin-io/resin-token).

[2.1.0]: https://github.com/resin-io/resin-request/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/resin-io/resin-request/compare/v1.3.0...v2.0.0
[1.3.0]: https://github.com/resin-io/resin-request/compare/v1.2.5...v1.3.0
[1.2.5]: https://github.com/resin-io/resin-request/compare/v1.2.4...v1.2.5
[1.2.4]: https://github.com/resin-io/resin-request/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/resin-io/resin-request/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/resin-io/resin-request/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/resin-io/resin-request/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/resin-io/resin-request/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/resin-io/resin-request/compare/v1.0.0...v1.1.0
