"""Smoke tests for bundled semgrep rules."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from pragmatiks_lint import list_rules, run_check
from pragmatiks_lint._rules import bundled_rules_directory


RuleCase = tuple[str, str]

RULE_CASES: tuple[RuleCase, ...] = (
    ("pra-srp-and-or-name", "srp_violation.py"),
    ("pra-srp-and-or-name-js", "srp_js_violation.js"),
    ("pra-no-abbreviations-python", "abbreviation_violation.py"),
    ("pra-no-block-comments-python", "block_comment_violation.py"),
    ("pra-no-block-comments-js", "block_comment_violation.js"),
    ("pra-no-todo-comments-python", "todo_violation.py"),
    ("pra-no-todo-comments-js", "todo_violation.js"),
    ("pra-io-prefix-mismatch", "io_prefix_violation.py"),
    ("pra-env-read-deep", "env_read_violation.py"),
)


@pytest.mark.parametrize(("rule_id", "fixture_name"), RULE_CASES)
def test_rule_fires(rule_id: str, fixture_name: str) -> None:
    """Run each rule against its canonical violation fixture."""
    fixture_path = Path(__file__).parent / "fixtures" / fixture_name
    findings = run_check([fixture_path])
    rule_ids = {finding.rule_id for finding in findings}
    assert any(item == rule_id or item.endswith(f".{rule_id}") for item in rule_ids)


def test_srp_js_boundaries_ignore_words() -> None:
    """Verify camel-case SRP matching ignores ordinary words containing And/Or."""
    fixture_path = Path(__file__).parent / "fixtures" / "srp_js_non_violation.js"
    findings = run_check([fixture_path], language="ts")
    assert not any(finding.rule_id.endswith("pra-srp-and-or-name-js") for finding in findings)


def test_list_rules_matches_yaml_rule_ids() -> None:
    """Verify the public rule list mirrors bundled YAML rule IDs."""
    expected_rule_ids: set[str] = set()
    with bundled_rules_directory() as rules_directory:
        for rule_file in rules_directory.glob("*.yml"):
            payload = yaml.safe_load(rule_file.read_text())
            expected_rule_ids.update(rule["id"] for rule in payload["rules"])

    assert set(list_rules()) == expected_rule_ids
