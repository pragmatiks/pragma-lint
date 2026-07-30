# Changelog

## js-v0.4.0 (2026-07-30)

### Features

- **rules**: flag db_* and *_db compounds in the abbreviation rule

## js-v0.3.4 (2026-05-25)

### Bug Fixes

- **js**: upgrade npm in CI to enable OIDC trusted publishers

## js-v0.3.3 (2026-05-25)

### Bug Fixes

- **js**: remove registry-url from setup-node so npm uses OIDC

## js-v0.3.2 (2026-05-25)

### Bug Fixes

- **js**: add OIDC subject debug step to publish workflow

## js-v0.3.1 (2026-05-25)

### Bug Fixes

- **js**: use npm publish for OIDC compatibility

## js-v0.3.0 (2026-05-25)

### Features

- **rules**: recognize pathlib + subprocess + shutil I/O in pra-io-prefix-mismatch (#4)

## js-v0.2.0 (2026-05-10)

### Misc

- chore(js): align npm baseline to 0.2.0 to match PyPI v0.2.0

## 0.1.0 - 2026-05-10

- Scaffolded the unified `pragma-lint` mono-repo.
- Added shared semgrep rules in `rules/`.
- Added library-only Python package `pragmatiks-lint`.
- Added library-only npm package `@pragmatiks/lint`.
- Added build-time rule vendoring for both package artifacts.
