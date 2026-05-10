"""Bundled semgrep rule discovery."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from importlib import resources
from pathlib import Path
from typing import Any, cast

import yaml


@contextmanager
def bundled_rules_directory() -> Iterator[Path]:
    """Yield bundled semgrep rules as a real filesystem path."""
    rules_reference = resources.files("pragmatiks_lint").joinpath("semgrep_rules")
    with resources.as_file(rules_reference) as rules_directory:
        yield rules_directory


def list_rules() -> list[str]:
    """Return bundled semgrep rule identifiers."""
    rules_reference = resources.files("pragmatiks_lint").joinpath("semgrep_rules")
    rule_ids: list[str] = []
    rule_files = sorted(
        (path for path in rules_reference.iterdir() if path.name.endswith(".yml")), key=lambda path: path.name
    )
    for rule_file in rule_files:
        rule_ids.extend(parse_rule_ids(rule_file.read_text()))
    return sorted(rule_ids)


def parse_rule_ids(rule_text: str) -> list[str]:
    """Return semgrep rule identifiers parsed from YAML text."""
    payload = cast(dict[str, Any] | None, yaml.safe_load(rule_text))
    if not payload:
        return []

    rules = payload.get("rules", [])
    if not isinstance(rules, list):
        return []

    rule_ids: list[str] = []
    for rule in rules:
        if isinstance(rule, dict) and isinstance(rule.get("id"), str):
            rule_ids.append(rule["id"])
    return rule_ids
