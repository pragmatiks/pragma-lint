"""Tests for the pragma-cli plugin app."""

from __future__ import annotations

from importlib.metadata import entry_points
from pathlib import Path

import typer
from typer.testing import CliRunner

from pragmatiks_lint import list_rules, run_check
from pragmatiks_lint.cli import app


def test_cli_app_exposes_check_and_rules() -> None:
    """Verify the plugin exports the expected Typer command surface."""
    assert isinstance(app, typer.Typer)
    assert any(command.name == "check" for command in app.registered_commands)
    assert any(group.name == "rules" for group in app.registered_groups)


def test_cli_invokes_check_and_rules_list() -> None:
    """Verify CLI commands route to the library runner and rule discovery."""
    runner = CliRunner()
    fixture_path = Path(__file__).parent / "fixtures" / "srp_violation.py"
    findings = run_check([fixture_path])

    check_result = runner.invoke(app, ["check", str(fixture_path)])

    assert check_result.exit_code == (1 if any(finding.is_blocker for finding in findings) else 0)
    assert "pra-srp-and-or-name" in check_result.stdout

    rules_result = runner.invoke(app, ["rules", "list"])

    assert rules_result.exit_code == 0
    for rule_id in list_rules():
        assert rule_id in rules_result.stdout


def test_pragma_commands_entry_point_loads_cli_app() -> None:
    """Verify editable installs expose the pragma.commands plugin entry point."""
    lint_entry_point = next(
        entry_point for entry_point in entry_points(group="pragma.commands") if entry_point.name == "lint"
    )

    assert lint_entry_point.value == "pragmatiks_lint.cli:app"
    assert lint_entry_point.load() is app
