"""Bundled semgrep rule discovery."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from importlib import resources
from pathlib import Path


@contextmanager
def bundled_rules_directory() -> Iterator[Path]:
    """Yield bundled semgrep rules as a real filesystem path."""
    rules_reference = resources.files("pragmatiks_lint").joinpath("semgrep_rules")
    with resources.as_file(rules_reference) as rules_directory:
        yield rules_directory


def list_rules() -> list[str]:
    """Return bundled semgrep rule identifiers."""
    rules_reference = resources.files("pragmatiks_lint").joinpath("semgrep_rules")
    return sorted(parse_rule_identifier(path.name) for path in rules_reference.iterdir() if path.name.endswith(".yml"))


def parse_rule_identifier(file_name: str) -> str:
    """Return a semgrep rule identifier derived from a rule file name."""
    return file_name.removesuffix(".yml").replace("_", "-")
