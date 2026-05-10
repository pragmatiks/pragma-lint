"""Semgrep runner for bundled Pragmatiks rules."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Literal, cast

from pragmatiks_lint._rules import bundled_rules_directory
from pragmatiks_lint.findings import Finding


Language = Literal["python", "ts", "all"]


def run_check(paths: list[Path], language: Language = "all") -> list[Finding]:
    """Run bundled semgrep rules against paths.

    Returns:
        Structured semgrep findings.

    Raises:
        RuntimeError: If semgrep times out or exits with an infrastructure error.
    """
    with bundled_rules_directory() as rules_directory:
        command = [
            "semgrep",
            "--config",
            str(rules_directory),
            "--json",
            "--quiet",
            *language_includes(language),
            *[str(path) for path in paths],
        ]
        try:
            result = subprocess.run(command, capture_output=True, check=False, text=True, timeout=600)
        except subprocess.TimeoutExpired as error:
            raise RuntimeError("semgrep timed out after 600 seconds") from error

    if result.returncode not in {0, 1}:
        raise RuntimeError(result.stderr.strip() or "semgrep failed")

    payload = cast(dict[str, Any], json.loads(result.stdout or '{"results": []}'))
    findings = payload.get("results", [])
    if not isinstance(findings, list):
        return []
    return [parse_finding(item) for item in findings if isinstance(item, dict)]


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
