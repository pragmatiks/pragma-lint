# pragmatiks-lint

Python library for running Pragmatiks semgrep rules.

```python
from pathlib import Path

from pragmatiks_lint import run_check

findings = run_check([Path("src")], language="python")
```

This package has no CLI entry point. Command-line integration belongs in `pragma-cli`.
