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
      additional_dependencies: ["pragmatiks-lint==0.6.0"]
      types: [python]
      pass_filenames: true
      stages: [pre-commit]
```

It has no `[project.scripts]` entry. Command-line integration belongs in `pragma-cli`.
