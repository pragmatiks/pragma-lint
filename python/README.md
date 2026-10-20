# pragmatiks-lint

Python library for running Pragmatiks semgrep rules.

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

It also ships a dependency source check that rejects committed paths leaving the repository: `tool.uv.sources` entries other than workspace members and in-repository paths, `tool.uv.workspace` members and excludes, `tool.ty.environment.extra-paths` entries, path specs (`file:`, `link:`, bare paths including `~/`) in `package.json` dependency fields, and `pnpm-workspace.yaml` packages, catalogs and overrides. It treats the working directory as the repository root, which is where pre-commit runs hooks:

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

Pin both hooks to the same version: pre-commit shares one environment between hooks only when their `additional_dependencies` match exactly.

It has no `[project.scripts]` entry. Command-line integration belongs in `pragma-cli`.
