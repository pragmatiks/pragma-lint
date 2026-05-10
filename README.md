# pragma-lint

Unified lint packages for Pragmatiks engineering principles.

This repository is library-only. It contains the Python package `pragmatiks-lint`, the npm package `@pragmatiks/lint`, and one shared semgrep ruleset in `rules/`.

The CLI surface belongs in `pragma-cli`.

## Packages

- `python/` exports `run_check`, `Finding`, and `list_rules` from `pragmatiks_lint`.
- `js/` exports `pragmatiksConfig`, eslint option constants, `PRAGMATIKS_LINT_FILES`, and semgrep rule path helpers from `@pragmatiks/lint`.

## Development

Use top-level Taskfile orchestration:

```bash
task python:install
task python:test
task js:install
task js:test
task all:check
task all:build
```

`rules/*.yml` is the source of truth. Build tasks vendor those files into each package artifact and the vendored copies are ignored by git.
