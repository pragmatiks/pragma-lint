"""Typer plugin app for pragma-cli."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console
from rich.table import Table

from pragmatiks_lint import list_rules, run_check
from pragmatiks_lint.findings import Finding
from pragmatiks_lint.runner import Language


PathsArgument = Annotated[
    list[Path],
    typer.Argument(
        exists=True,
        readable=True,
        help="Files or directories to lint.",
    ),
]
LanguageOption = Annotated[
    Language,
    typer.Option(
        "--language",
        "-l",
        help="Language filter: python, ts, or all.",
    ),
]

app = typer.Typer(
    name="lint",
    help="Enforce Pragmatiks engineering principles on the given paths.",
    no_args_is_help=True,
)
rules_group = typer.Typer(
    help="Inspect bundled lint rules.",
    no_args_is_help=True,
)
app.add_typer(rules_group, name="rules", help="Inspect bundled lint rules.")

console = Console(width=200)


@app.command("check")
def check(paths: PathsArgument, language: LanguageOption = "all") -> None:
    """Run lint rules against the given paths.

    Raises:
        typer.Exit: With status 1 when blocking findings exist.
    """
    findings = run_check(paths, language=language)
    if not findings:
        console.print("[green]No findings.[/green]")
        raise typer.Exit(0)

    console.print(format_findings(findings))
    blockers = sum(finding.is_blocker for finding in findings)
    raise typer.Exit(1 if blockers else 0)


@rules_group.command("list")
def rules_list() -> None:
    """List bundled rule identifiers."""
    table = Table("Rule ID")
    for rule_id in list_rules():
        table.add_row(rule_id)
    console.print(table)


def format_findings(findings: list[Finding]) -> Table:
    """Format findings for terminal output.

    Returns:
        Rich table containing the finding details.
    """
    table = Table("Path", "Line", "Rule", "Severity", "Message")
    for finding in findings:
        table.add_row(
            finding.path,
            str(finding.line),
            finding.rule_id,
            finding.severity,
            finding.message,
        )
    return table
