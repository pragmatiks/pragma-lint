# pragma-lint

The Pragmatiks lint libraries: shared semgrep rules in `rules/`, consumed by the `pragmatiks-lint` Python package (`python/`) and the `@pragmatiks/lint` npm package (`js/`), each versioned and published on its own.

Delivery: pragma-kit `project-instructions.md`. Engineering rules: the `pragma-kit:engineering-principles` skill; load it before planning, writing or reviewing a change. Toolchain, tasks and tests: `docs/development.md`. Package constraints: `docs/packaging.md`. Releases: `docs/releasing.md`.

## Gotchas

- **Library only.** No `[project.scripts]` and no npm `bin`. The only module entries are the pre-commit hooks `python -m pragmatiks_lint.comments`, `.sources` and `.uv_pip`; CLI dependencies belong in pragma-cli (`docs/packaging.md`).
- **Light base install.** The Python base install is PyYAML alone, so the hooks stay light; semgrep, typer and rich sit behind the `check` extra. `mise run python:check-base` proves it (`docs/packaging.md`).
- **Every repository runs these hooks.** `pragmatiks_lint.sources` and `pragmatiks_lint.uv_pip` enforce registry-only dependencies and no `uv pip` across Pragmatiks, so a change here changes what every consumer accepts (`docs/packaging.md`).
- **Scoped commits.** `feat(python)`, `feat(js)` and `feat(rules)` (and `fix`) pick which package bumps; publish workflows are path-filtered (`docs/releasing.md`).
- **Publish only with explicit authorization.** Run `cz bump` only inside `python/` or `js/`, since `--config` from the root silently skips `[project].version`. A wedged publish is fixed forward to the next patch; moving a pushed tag needs supervisor authorization (`docs/releasing.md`).
- **Principle changes** start in the pragma-kit engineering-principles skill, then update and publish the matching rules here, then bump consumers (`docs/development.md`).
- **Secrets.** Never commit secrets, token-bearing `.npmrc` or `.pypirc`, MCP auth files or local credentials; publishing uses OIDC trusted publishers.
- **Setup.** Fresh clone: `mise trust`, then `mise run install`; `mise run check` runs every check. `aqua:npm/cli` stays first in `mise.toml` so its npm precedes node's.
