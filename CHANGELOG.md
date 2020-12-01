# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://github.com/olivierlacan/keep-a-changelog).

## [Unreleased]

## [1.0.5]

### Changed
- Fixes in README
- Log on every alert instead of interval

## [1.0.1]

### Added
- Clear separation of scaling events and recovery

### Changed
- Recover events will send a message with the function recover in the template

## [1.0.0]

### Added
- Example for using a slack messager
- Logger init verification

### Changed
- Simplify ecs-api by moving some logic to Checker
- Require AWS region to be provided

[unreleased]: https://github.com/riseupil/mona/compare/1.0.0...HEAD
[1.0.0]: https://github.com/riseupil/mona/releases/tag/1.0.0
[1.0.1]: https://github.com/riseupil/mona/releases/tag/1.0.1
[1.0.5]: https://github.com/riseupil/mona/releases/tag/1.0.5
