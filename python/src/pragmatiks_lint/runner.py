"""Semgrep runner for bundled Pragmatiks rules."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Literal, cast

from pragmatiks_lint._rules import bundled_rules_directory
from pragmatiks_lint.findings import Finding


Language = Literal["python", "ts", "all"]
DEFAULT_EXCLUDED_PATTERNS = (
    "_darcs",
    "build/",
    "vendor/",
    "*.min.js",
    "node_modules/",
    ".yarn/",
    ".venv/",
    "_opam/",
    "_build/",
    "_cargo/",
)
TEST_DIRECTORY_NAMES = frozenset({"tests", "test", "testsuite"})
SEMGREP_MISSING_MESSAGE = "semgrep is not installed; install pragmatiks-lint[check] to run the Pragmatiks semgrep rules"


def run_check(paths: list[Path], language: Language = "all") -> list[Finding]:
    """Run bundled semgrep rules against paths.

    Test directories (``tests/``, ``test/``, ``testsuite/``) are always scanned. Every ``.semgrepignore`` file is
    bypassed, and the ignore policy is rebuilt as ``--exclude`` arguments: semgrep's default ignore list without
    its test entries, plus the entries of the ``.semgrepignore`` in the current working directory, except any
    entry naming a test directory, a negation (``!``) or a directive (``:include``). Gitignored files stay out
    through semgrep's git filter.

    Note:
        ``--x-ignore-semgrepignore-files`` is the only semgrep switch that drops the default ignore list from
        the command line, and semgrep labels it internal. ``DEFAULT_EXCLUDED_PATTERNS`` mirrors the default
        list of the ``semgrep`` floor in ``pyproject.toml``; a semgrep upgrade re-checks both.

    Returns:
        Structured semgrep findings.

    Raises:
        RuntimeError: If the semgrep executable is not installed (it ships with the ``pragmatiks-lint[check]``
            extra), or if semgrep times out or exits with an infrastructure error.
    """
    with bundled_rules_directory() as rules_directory:
        command = [
            "semgrep",
            "--config",
            str(rules_directory),
            "--json",
            "--quiet",
            "--x-ignore-semgrepignore-files",
            *exclude_arguments(read_semgrepignore(Path(".semgrepignore"))),
            *language_includes(language),
            *[str(path) for path in paths],
        ]
        try:
            result = subprocess.run(command, capture_output=True, check=False, text=True, timeout=600)
        except FileNotFoundError as error:
            raise RuntimeError(SEMGREP_MISSING_MESSAGE) from error
        except subprocess.TimeoutExpired as error:
            raise RuntimeError("semgrep timed out after 600 seconds") from error

    if result.returncode not in {0, 1}:
        raise RuntimeError(result.stderr.strip() or "semgrep failed")

    payload = cast(dict[str, Any], json.loads(result.stdout or '{"results": []}'))
    findings = payload.get("results", [])
    if not isinstance(findings, list):
        return []
    return [parse_finding(item) for item in findings if isinstance(item, dict)]


def read_semgrepignore(path: Path) -> str:
    """Read a ``.semgrepignore`` file.

    Returns:
        The file's text, or an empty string when it does not exist.
    """
    try:
        return path.read_text()
    except FileNotFoundError:
        return ""


def parse_semgrepignore(text: str) -> list[str]:
    """Return the ``.semgrepignore`` patterns the runner honors.

    Blank lines, comments, negations, directives and patterns with a test directory segment are dropped.
    """
    patterns = [line.strip() for line in text.splitlines()]
    return [
        pattern for pattern in patterns if pattern and pattern[0] not in "#!:" and not names_test_directory(pattern)
    ]


def names_test_directory(pattern: str) -> bool:
    """Return whether a gitignore-style pattern has a test directory segment."""
    return any(segment in TEST_DIRECTORY_NAMES for segment in pattern.split("/"))


def exclude_arguments(semgrepignore_text: str) -> list[str]:
    """Return semgrep exclude arguments for the default ignores and a consumer's ``.semgrepignore`` text."""
    patterns = [*DEFAULT_EXCLUDED_PATTERNS, *parse_semgrepignore(semgrepignore_text)]
    return [argument for pattern in patterns for argument in ("--exclude", pattern)]


def language_includes(language: Language) -> list[str]:
    """Return semgrep include arguments for one language mode."""
    if language == "python":
        return ["--include", "*.py"]
    if language == "ts":
        return ["--include", "*.ts", "--include", "*.tsx", "--include", "*.js", "--include", "*.jsx"]
    return []


def parse_finding(item: dict[str, Any]) -> Finding:
    """Convert a semgrep JSON result into a Finding.

    Returns:
        Structured finding with defaulted fields.
    """
    start = typed_mapping(item.get("start"))
    extra = typed_mapping(item.get("extra"))
    line_value = start.get("line", 1)

    return Finding(
        path=str(item.get("path", "")),
        line=line_value if isinstance(line_value, int) else 1,
        rule_id=str(item.get("check_id", "")),
        severity=str(extra.get("severity", "INFO")),
        message=str(extra.get("message", "")),
    )


def typed_mapping(value: object) -> dict[str, object]:
    """Return a string-key mapping when semgrep JSON gives one."""
    if isinstance(value, dict):
        return {str(key): item for key, item in value.items()}
    return {}
