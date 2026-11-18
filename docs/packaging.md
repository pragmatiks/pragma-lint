# Packaging

What each package may ship and depend on, and what the hook modules enforce in consuming repositories.

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

## Dependency policy

Keep both packages library-only; `python -m pragmatiks_lint.comments`, `python -m pragmatiks_lint.sources` and `python -m pragmatiks_lint.uv_pip` are the three sanctioned module entries (pre-commit hook targets; they need `pragmatiks-lint` installed). CLI dependencies belong in `pragma-cli`, not here. JS uses peer dependencies for eslint ecosystem packages consumed by exported config, and dev dependencies for local tooling. Use registry-based dependencies only; do not commit editable sibling overrides. `pragmatiks_lint.sources` enforces that rule in every Pragmatiks repository that installs its hook: committed `tool.uv.sources` paths, uv workspace members, ty `extra-paths`, PEP 508 direct references to paths in `project` dependencies, `dependency-groups`, `tool.uv` dev, override, constraint and build-constraint dependencies and `build-system.requires` (a location without a URL scheme counts as a path, as uv reads it), `package.json` path specs (including specs without a protocol that contain `/` or name a tarball, as npm reads them) and `pnpm-workspace.yaml` packages, catalogs and overrides must resolve inside the repository, and a PEP 508 direct reference to any other URL (http, https, git or other VCS) in those lists, or a git, hosted git (`github:`, `owner/repository`) or tarball URL spec in those `package.json` and `pnpm-workspace.yaml` maps, is rejected. `pragmatiks_lint.uv_pip` rejects `uv pip` in mise configuration, tasks, scripts, workflows and Dockerfiles.
