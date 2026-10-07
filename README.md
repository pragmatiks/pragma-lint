# pragma-lint

Unified lint packages for Pragmatiks engineering principles.

This repository is library-only. It contains the Python package `pragmatiks-lint`, the npm package `@pragmatiks/lint`, and one shared semgrep ruleset in `rules/`.

The CLI surface belongs in `pragma-cli`.

## Packages

- `python/` exports `run_check`, `Finding`, and `list_rules` from `pragmatiks_lint`, and ships the strict no-comments check `pragmatiks_lint.comments` (`python -m pragmatiks_lint.comments <files>`, a pre-commit hook target).
- `js/` exports `pragmatiksConfig`, eslint option constants, `PRAGMATIKS_LINT_FILES`, and semgrep rule path helpers from `@pragmatiks/lint`, and `pragmatiksNextConfig` for Next.js apps from `@pragmatiks/lint/eslint-config/next`.

## Development

Use top-level Taskfile orchestration:

```bash
task all:install
task python:install
task python:test
task js:install
task js:test
task all:check
task all:build
```

`task all:install` installs both packages' dependencies and the repository's pre-commit hook.

`rules/*.yml` is the source of truth. Build tasks vendor those files into each package artifact and the vendored copies are ignored by git.
