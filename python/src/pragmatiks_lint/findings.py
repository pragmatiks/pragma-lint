"""Finding model returned by the library runner."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Finding:
    """Structured semgrep finding."""

    path: str
    line: int
    rule_id: str
    severity: str
    message: str

    @property
    def is_blocker(self) -> bool:
        """Return whether the finding is a blocking semgrep error."""
        return self.severity == "ERROR"
