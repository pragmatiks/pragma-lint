# Changelog

## 0.1.0 - 2026-05-10

- Scaffolded the unified `pragma-lint` mono-repo.
- Added shared semgrep rules in `rules/`.
- Added library-only Python package `pragmatiks-lint`.
- Added library-only npm package `@pragmatiks/lint`.
- Added build-time rule vendoring for both package artifacts.

## python-v0.11.1 (2026-11-08)

### Bug Fixes

- **rules**: flag pure-prefix results bound only to _ in pra-pure-call-result-dropped (PRA-733)

## python-v0.11.0 (2026-11-08)

### Features

- **rules**: add Python shape rules from the PRA-703 reviews (PRA-733)

## python-v0.10.0 (2026-11-08)

### Features

- **rules**: drop the TS/JS comment semgrep rules the ESLint rules replace (PRA-680)

## python-v0.9.1 (2026-11-07)

### Bug Fixes

- **python**: reject URL and VCS dependency references and scan the uv and build requirement lists (PRA-932)

## python-v0.9.0 (2026-11-07)

### Bug Fixes

- **python**: reject PEP 508 path direct references outside the repository (PRA-745)

### Features

- **python**: move semgrep, typer and rich behind the check extra (PRA-683)
- **python**: add the check-uv-pip hook rejecting uv pip in tracked files (PRA-744)

## python-v0.8.0 (2026-11-07)

### Features

- **rules**: flag pure-prefixed functions that perform I/O (PRA-453, PRA-750)

## python-v0.7.0 (2026-10-20)

### Features

- **python**: ship the sibling-path source check as pragmatiks_lint.sources

## python-v0.6.0 (2026-10-07)

### Bug Fixes

- **rules**: recognize Path.open and with-open as file I/O in pra-io-prefix-mismatch

### Features

- **python**: ship the strict no-comments check as pragmatiks_lint.comments
- **rules**: drop the Python comment rules the strict comment check replaces

## python-v0.5.0 (2026-07-30)

### Features

- **rules**: flag db_* and *_db compounds in the abbreviation rule

## python-v0.4.0 (2026-05-25)

### Features

- **rules**: recognize pathlib + subprocess + shutil I/O in pra-io-prefix-mismatch (#4)

## python-v0.3.1 (2026-05-11)

### Bug Fixes

- **python**: correct cz invocation in publish workflows

## python-v0.3.0 (2026-05-11)

### Features

- **python**: add Typer CLI plugin module + pragma.commands entry point

## python-v0.2.0 (2026-05-10)

### Feat

- initial scaffold of pragma-lint v0.1.0 — unified mono-repo (PRA-418)

### Fix

- address PRA-418 review feedback
