"""Smoke tests for bundled semgrep rules."""

from __future__ import annotations

from pathlib import Path

import pytest

from pragmatiks_lint import run_check


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
