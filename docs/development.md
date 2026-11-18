# Development

Toolchain, tasks, tests and how a principle change flows into the rules.

## Toolchain

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
| `mise run python:test` | Python rule smoke tests and the comment-check, source-check, `uv pip`-check and `pragma lint` command tests |
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

Run `mise run python:test` for Python semgrep smoke coverage and the `pragmatiks_lint.comments`, `pragmatiks_lint.sources` and `pragmatiks_lint.uv_pip` check tests and the `pragma lint` command tests, and `mise run js:test` for eslint config integration coverage.

## Maintenance

The engineering principles live in the pragma-kit plugin's `skills/engineering-principles/SKILL.md`. To change a principle:

1. Edit that skill in pragma-kit.
2. Update the matching `pragmatiks-lint` / `@pragmatiks/lint` rules here and publish.
3. Bump consumers (lockfile bumps cascade like SDK changes).
