# pragmatiks-lint

Python library for running Pragmatiks semgrep rules, and pre-commit checks for Pragmatiks repositories.

The base install carries PyYAML alone, which is all the pre-commit checks below need. Running the semgrep rules
through `run_check` or the `pragma lint` command needs the `check` extra, which adds semgrep, typer and rich:
install `pragmatiks-lint[check]`. Without it, `run_check` raises a `RuntimeError` naming the extra, and `pragma lint check`
prints that message and exits 1. The `pragma.commands` entry point ships in the base install, since entry points
cannot be gated on an extra, but `pragmatiks_lint.cli` imports typer and rich: a package that mounts `pragma lint`
must depend on `pragmatiks-lint[check]`, or pragma-cli skips the plugin with a warning.

```python
from pathlib import Path

from pragmatiks_lint import run_check

findings = run_check([Path("src")], language="python")
```

The package also ships a strict no-comments check for Python files, run as a module by a local pre-commit hook:

```yaml
- repo: local
  hooks:
    - id: check-comments
      name: Enforce NO COMMENTS policy
      entry: python -m pragmatiks_lint.comments
      language: python
      language_version: python3.13
      additional_dependencies: ["pragmatiks-lint==0.7.0"]
      types: [python]
      pass_filenames: true
      stages: [pre-commit]
```

It also ships a dependency source check that rejects committed paths leaving the repository and dependencies that do not resolve from a registry: `tool.uv.sources` entries other than workspace members and in-repository paths, `tool.uv.workspace` members and excludes, `tool.ty.environment.extra-paths` entries, PEP 508 direct references to a `file:` URL or a location without a URL scheme (which uv reads as a path, so `vendor/pkg` as well as `./vendor/pkg`) in `project.dependencies`, `project.optional-dependencies`, `dependency-groups`, `tool.uv.dev-dependencies`, `tool.uv.override-dependencies`, `tool.uv.constraint-dependencies`, `tool.uv.build-constraint-dependencies` and `build-system.requires` (`${PROJECT_ROOT}` expands to the manifest's directory), PEP 508 direct references to any other URL in those lists (`https:`, `http:`, `git+https:`, `git+ssh:` and other VCS schemes), path specs (`file:`, `link:`, specs starting with `.`, `/` or `~/`, and, as npm reads them, other specs containing `/` or ending in `.tgz`, `.tar.gz` or `.tar`) in `package.json` dependency fields, and `pnpm-workspace.yaml` packages, catalogs and overrides, and in those `package.json` fields, catalogs and overrides any spec with a protocol other than `npm:`, `jsr:`, `workspace:` and `catalog:` (git, `github:` and other hosted git, `http:` and `https:` tarballs), an scp-style git location (`git@host:path`) or a GitHub shorthand (`owner/repository`). It treats the working directory as the repository root, which is where pre-commit runs hooks:

```yaml
- repo: local
  hooks:
    - id: check-sources
      name: Reject non-registry dependency sources
      entry: python -m pragmatiks_lint.sources
      language: python
      language_version: python3.13
      additional_dependencies: ["pragmatiks-lint==0.7.0"]
      files: (^|/)(pyproject\.toml|package\.json|pnpm-workspace\.yaml)$
      pass_filenames: true
      stages: [pre-commit]
```

It also ships a check that rejects `uv pip` in files that run commands: mise configuration, container builds, shell scripts, and non-prose files under `.mise/tasks`, `mise-tasks`, `tasks`, `scripts` and `.github/workflows`. The module chooses those files itself, so the hook takes every staged file and documentation passes:

```yaml
- repo: local
  hooks:
    - id: check-uv-pip
      name: Reject uv pip in tracked files
      entry: python -m pragmatiks_lint.uv_pip
      language: python
      language_version: python3.13
      additional_dependencies: ["pragmatiks-lint==0.7.0"]
      pass_filenames: true
      stages: [pre-commit]
```

Pin every hook to the same version, the first release that ships `pragmatiks_lint.uv_pip` or later: pre-commit shares one environment between hooks only when their `additional_dependencies` match exactly.

It has no `[project.scripts]` entry. Command-line integration belongs in `pragma-cli`.
