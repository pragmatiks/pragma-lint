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

It also ships a dependency source check that rejects committed paths leaving the repository: `tool.uv.sources` entries other than workspace members and in-repository paths, `tool.uv.workspace` members and excludes, `tool.ty.environment.extra-paths` entries, PEP 508 direct references to a `file:` URL or bare path in `project.dependencies`, `project.optional-dependencies` and `dependency-groups` (`${PROJECT_ROOT}` expands to the manifest's directory), path specs (`file:`, `link:`, bare paths including `~/`) in `package.json` dependency fields, and `pnpm-workspace.yaml` packages, catalogs and overrides. It treats the working directory as the repository root, which is where pre-commit runs hooks:

```yaml
- repo: local
  hooks:
    - id: check-sources
      name: Reject sibling path overrides
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
