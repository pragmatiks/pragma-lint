# CLAUDE.md

## Project

**pragma-lint**: mono-repo for Pragmatiks lint libraries with independent package versions.

## Shared rules

Delivery lives in pragma-kit `project-instructions.md`. Evidence-based development, the solution preference order, the new-dependency proposal, the 13 engineering principles and the reviewer and developer protocols live in the pragma-kit plugin's `pragma-kit:engineering-principles` skill: load it before planning, writing or reviewing a change here. This file holds only what is specific to this repository.

## Architecture

```
pragma-lint/
├── rules/      # shared semgrep source of truth
├── python/     # pragmatiks-lint Python library package
└── js/         # @pragmatiks/lint npm library package
```

Python and JS publish independently through separate workflows. Shared `rules/` changes are consumed by both packages and trigger both release paths. Humans change `main` only through pull requests; the pragma-ci-bot GitHub App pushes the release bump commits (see Publishing). Release identity and branch protection are documented in the pragma-os hub's runbooks.

## Constraints

- Library-only: no Python `[project.scripts]` entry and no npm `bin` field. The three sanctioned module entries are pre-commit hook targets: `python -m pragmatiks_lint.comments`, `python -m pragmatiks_lint.sources` and `python -m pragmatiks_lint.uv_pip`. `comments.py`, `uv_pip.py` and the shared `report.py` import only the standard library and `sources.py` adds PyYAML; `-m` still imports the package `__init__` and its dependencies.
- The Python base install is PyYAML alone, so the hooks stay light. semgrep, typer and rich sit behind the `check` extra (`pragmatiks-lint[check]`), which `run_check` and the `pragma lint` command need; without it `run_check` raises a `RuntimeError` naming the extra and `pragma lint check` exits 1 with that message. The `pragma.commands` entry point stays in the base install (entry points cannot be gated), so a consumer mounting `pragma lint` must depend on `pragmatiks-lint[check]`. `mise run python:check-base` builds the wheel and proves its base install carries none of them and runs all three hook modules.
- Build tasks vendor `rules/*.yml` into package-local ignored directories.
- Do not publish packages from this repository without explicit authorization; pushes and pull requests follow Delivery.

## Development

mise is the only toolchain source: `mise.toml` pins python, node, pnpm, uv, pre-commit, commitizen and yq; `aqua:npm/cli` stays first so its npm precedes node's on PATH. `mise.lock` and `.mise/locks/` lock them for macOS arm64 and Linux x64. On a fresh clone run `mise trust`, then `mise run install`.

Use mise tasks (`mise tasks` lists them all):

| Command | Purpose |
|---------|---------|
| `mise run install` | Install the locked toolchain, Python and JS dependencies and the pre-commit hook |
| `mise run lock:toolchain` | Re-lock the toolchain after editing `mise.toml` (needs mise at the `min_version` in `mise.toml`) |
| `mise run check:mise-pins` | Fail when a `jdx/mise-action` step's `version:` or `sha256:` differs from `min_version` and its runner's mise binary checksum |
| `mise run check:toolchain-scripts` | Fail when a shared toolchain script under `scripts/tasks/` or the git hook `scripts/git_hooks/hook.sh` differs from the public repositories' copies (same-named branch, else `main`) |
| `mise run python:install` | Install Python dependencies |
| `mise run python:check` | Ruff and mypy |
| `mise run python:test` | Python rule smoke tests, comment-check tests and source-check tests |
| `mise run python:build` | Build wheel and sdist |
| `mise run python:check-base` | Prove the wheel's base install has no semgrep, typer or rich and runs every hook module |
| `mise run js:install` | Install JS dependencies |
| `mise run js:check` | ESLint and TypeScript |
| `mise run js:test` | Vitest integration tests (Node >=22.15) |
| `mise run js:build` | Build npm dist |
| `mise run js:pack` | Pack the committed HEAD as an npm tarball with the CI publish toolchain (commit first) |
| `mise run all:install` | Install Python and JS dependencies and the pre-commit hook |
| `mise run all:check` (alias `mise run check`) | Run all checks |

## Testing

Run `mise run python:test` for Python semgrep smoke coverage and the `pragmatiks_lint.comments`, `pragmatiks_lint.sources` and `pragmatiks_lint.uv_pip` check tests, and `mise run js:test` for eslint config integration coverage. This repository has no e2e suite.

## Dependency Policy

Keep both packages library-only; `python -m pragmatiks_lint.comments`, `python -m pragmatiks_lint.sources` and `python -m pragmatiks_lint.uv_pip` are the three sanctioned module entries (pre-commit hook targets; they need `pragmatiks-lint` installed). CLI dependencies belong in `pragma-cli`, not here. JS uses peer dependencies for eslint ecosystem packages consumed by exported config, and dev dependencies for local tooling. Use registry-based dependencies only; do not commit editable sibling overrides. `pragmatiks_lint.sources` enforces that rule in every Pragmatiks repository that installs its hook: committed `tool.uv.sources` paths, uv workspace members, ty `extra-paths`, PEP 508 direct references to paths in `project` dependencies, `dependency-groups`, `tool.uv` dev, override, constraint and build-constraint dependencies and `build-system.requires` (a location without a URL scheme counts as a path, as uv reads it), `package.json` path specs (including specs without a protocol that contain `/` or name a tarball, as npm reads them) and `pnpm-workspace.yaml` packages, catalogs and overrides must resolve inside the repository, and a PEP 508 direct reference to any other URL (http, https, git or other VCS) in those lists, or a git, hosted git (`github:`, `owner/repository`) or tarball URL spec in those `package.json` and `pnpm-workspace.yaml` maps, is rejected. `pragmatiks_lint.uv_pip` rejects `uv pip` in mise configuration, tasks, scripts, workflows and Dockerfiles.

## Secrets

Do not commit secrets, `.npmrc` or `.pypirc` files with tokens, MCP auth files, or local machine credentials. Publishing uses OIDC trusted publishers, not repository package tokens.

## Issue references

Reference PRA-nnn issue IDs in implementation notes and callbacks. Use conventional commits for repository history.

## Commit Messages

Use package scopes so path-filtered publish workflows bump only the intended package:

- `feat(python): ...` / `fix(python): ...` bumps the Python package.
- `feat(js): ...` / `fix(js): ...` bumps the JS package.
- `feat(rules): ...` / `fix(rules): ...` bumps both packages.
- `chore(ci): ...` and other non-package maintenance commits do not publish when path filters exclude package and rule paths.

## Publishing

Publish only with explicit authorization. Python publishes through `.github/workflows/publish-python.yaml` with tags named `python-v{version}`. JS publishes through `.github/workflows/publish-js.yaml` with tags named `js-v{version}`. Both workflows use OIDC trusted publishers and package-local Commitizen config. Do not create shared `v{version}` tags.

Each run starts on a merge to `main` that touches its paths, or by `workflow_dispatch` from `main`. Both workflows share one concurrency queue, so releases run one at a time against the latest `main`. An unprivileged `bump` job runs Commitizen and uv and hands the `[skip ci]` bump commit and tag to the `push` job as a git bundle; `push` runs in the `release` environment, mints the pragma-ci-bot token and pushes `main` and the tag atomically. If `main` moved during the run, the push is rejected and the run stops without releasing; `push` then dispatches a new run of the same workflow on `main`, which bumps from the latest `main`. The npm/PyPI publish and GitHub Release jobs build from the tagged commit and are idempotent. A release is complete once its GitHub Release exists, which is created last: when a run finds nothing to bump but the current version's tag has no GitHub Release, it skips the push and finishes publishing that tag. So after a failure past the push, any later run of the same workflow (re-run, `workflow_dispatch`, or the next matching merge) completes the release.

`cz bump` must be invoked from inside the package directory (`python/` or `js/`); never pass `--config <path>` from the repo root. `version_files` resolves against the current working directory, and the `--config` form silently fails to update `[project].version` (root cause of the failed 0.3.0 publish, recovered via 0.3.1 fix-forward).

Re-pointing an already-pushed tag requires explicit supervisor authorization. Default recovery for a wedged publish is fix-forward to the next patch version (e.g. 0.3.1 → 0.3.2), not force-moving the existing tag.

## Maintenance

The engineering principles live in the pragma-kit plugin's `skills/engineering-principles/SKILL.md`. To change a principle:

1. Edit that skill in pragma-kit.
2. Update the matching `pragmatiks-lint` / `@pragmatiks/lint` rules here and publish.
3. Bump consumers (lockfile bumps cascade like SDK changes).
