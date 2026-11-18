# Releasing

Commit scopes, publishing workflows and recovery for `pragmatiks-lint` and `@pragmatiks/lint`.

## Commit messages

Reference PRA-nnn issue IDs in implementation notes and callbacks. Use conventional commits for repository history.

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
