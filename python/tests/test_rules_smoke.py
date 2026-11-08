"""Smoke tests for bundled semgrep rules."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from pragmatiks_lint import list_rules, run_check
from pragmatiks_lint._rules import bundled_rules_directory


def find_rule_lines(fixture_name: str, rule_id: str) -> set[int]:
    """Return the lines where a rule fires on a fixture.

    Args:
        fixture_name: File name under the fixtures directory.
        rule_id: Rule ID to keep.

    Returns:
        Start lines of the rule's findings.
    """
    fixture_path = Path(__file__).parent / "fixtures" / fixture_name
    findings = run_check([fixture_path])
    return {
        finding.line for finding in findings if finding.rule_id == rule_id or finding.rule_id.endswith(f".{rule_id}")
    }


RuleCase = tuple[str, str]

RULE_CASES: tuple[RuleCase, ...] = (
    ("pra-srp-and-or-name", "srp_violation.py"),
    ("pra-srp-and-or-name-js", "srp_js_violation.js"),
    ("pra-no-abbreviations-python", "abbreviation_violation.py"),
    ("pra-no-abbreviations-python", "abbreviation_db_compound_violation.py"),
    ("pra-io-prefix-mismatch", "io_prefix_violation.py"),
    ("pra-env-read-deep", "env_read_violation.py"),
    ("pra-pure-prefix-mismatch", "pure_prefix_mismatch_violation.py"),
)


@pytest.mark.parametrize(("rule_id", "fixture_name"), RULE_CASES)
def test_rule_fires(rule_id: str, fixture_name: str) -> None:
    """Run each rule against its canonical violation fixture."""
    assert find_rule_lines(fixture_name, rule_id)


def test_srp_js_boundaries_ignore_words() -> None:
    """Verify camel-case SRP matching ignores ordinary words containing And/Or."""
    fixture_path = Path(__file__).parent / "fixtures" / "srp_js_non_violation.js"
    findings = run_check([fixture_path], language="ts")
    assert not any(finding.rule_id.endswith("pra-srp-and-or-name-js") for finding in findings)


IO_PREFIX_NON_VIOLATION_FIXTURES: tuple[str, ...] = (
    "io_prefix_builtin_open_non_violation.py",
    "io_prefix_pathlib_non_violation.py",
    "io_prefix_subprocess_non_violation.py",
    "io_prefix_resolution_non_violation.py",
)


@pytest.mark.parametrize("fixture_name", IO_PREFIX_NON_VIOLATION_FIXTURES)
def test_io_prefix_recognizes_hidden_io(fixture_name: str) -> None:
    """Verify file, pathlib, subprocess, shutil, path resolution and module import idioms count as I/O."""
    assert find_rule_lines(fixture_name, "pra-io-prefix-mismatch") == set()


def test_list_rules_matches_yaml_rule_ids() -> None:
    """Verify the public rule list mirrors bundled YAML rule IDs."""
    expected_rule_ids: set[str] = set()
    with bundled_rules_directory() as rules_directory:
        for rule_file in rules_directory.glob("*.yml"):
            payload = yaml.safe_load(rule_file.read_text())
            expected_rule_ids.update(rule["id"] for rule in payload["rules"])

    assert set(list_rules()) == expected_rule_ids


def test_pure_prefix_mismatch_flags_every_io_function() -> None:
    """Verify every pure-prefixed function performing I/O in the violation fixture is flagged."""
    assert find_rule_lines("pure_prefix_mismatch_violation.py", "pra-pure-prefix-mismatch") == {12, 16, 21, 26}


def test_pure_prefix_mismatch_ignores_pure_functions() -> None:
    """Verify pure-prefixed functions without I/O, including one awaiting a coroutine, are not flagged."""
    assert find_rule_lines("pure_prefix_mismatch_non_violation.py", "pra-pure-prefix-mismatch") == set()


ShapeRuleCase = tuple[str, str, frozenset[int]]

SHAPE_RULE_CASES: tuple[ShapeRuleCase, ...] = (
    ("pra-pure-call-result-dropped", "pure_call_result_dropped", frozenset({5, 6, 7, 8})),
    ("pra-parsed-result-index", "parsed_result_index", frozenset({5, 6})),
    ("pra-if-chain-else-continue", "if_chain_else_continue", frozenset({9})),
    ("pra-exists-gated-read", "exists_gated_read", frozenset({5})),
    ("pra-multi-underscore-unpack", "multi_underscore_unpack", frozenset({5, 6})),
    ("pra-optional-tuple-index", "optional_tuple_index", frozenset({5, 6, 7, 8, 9})),
)


@pytest.mark.parametrize(("rule_id", "fixture_stem", "expected_lines"), SHAPE_RULE_CASES)
def test_shape_rule_flags_every_violation(rule_id: str, fixture_stem: str, expected_lines: frozenset[int]) -> None:
    """Verify each Python shape rule flags every violating line of its fixture."""
    assert find_rule_lines(f"{fixture_stem}_violation.py", rule_id) == expected_lines


@pytest.mark.parametrize(("rule_id", "fixture_stem"), [(rule_id, stem) for rule_id, stem, _ in SHAPE_RULE_CASES])
def test_shape_rule_ignores_accepted_shapes(rule_id: str, fixture_stem: str) -> None:
    """Verify each Python shape rule leaves the accepted shapes in its non-violation fixture alone."""
    assert find_rule_lines(f"{fixture_stem}_non_violation.py", rule_id) == set()
