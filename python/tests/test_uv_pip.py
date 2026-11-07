"""Tests for the uv pip check."""

from __future__ import annotations

from pathlib import Path

import pytest

from pragmatiks_lint.uv_pip import collect_report_lines, is_checked_path, main


CHECKED_PATHS = (
    "mise.toml",
    "mise.production.toml",
    ".mise.toml",
    ".mise/config.toml",
    "packages/api/mise.toml",
    ".mise/tasks/install",
    "mise-tasks/build",
    "tasks/python.toml",
    "scripts/tasks/js_pack.sh",
    "scripts/release.py",
    ".github/workflows/ci.yaml",
    "Dockerfile",
    "deploy/Dockerfile.runtime",
    "deploy/runner.Dockerfile",
    "tools/setup.bash",
)

UNCHECKED_PATHS = (
    "README.md",
    "docs/patterns/dependency-resolution.md",
    "scripts/README.md",
    "tasks/notes.txt",
    ".github/workflows/README.rst",
    "pyproject.toml",
    "src/pragmatiks_lint/uv_pip.py",
    "config.toml",
)

HITS = (
    ("mise.toml", '[tasks.install]\nrun = "uv pip install -e ."\n', 2),
    ("Dockerfile", "FROM python:3.13\nRUN uv pip install --system pkg\n", 2),
    (".github/workflows/ci.yaml", "steps:\n  - run: 'uv  pip sync requirements.txt'\n", 2),
    ("scripts/setup.sh", "#!/bin/sh\nuv \\\n  pip install pkg\n", 2),
    ("tasks/python.toml", 'run = ["uv\tpip list"]\n', 1),
)

MISSES = (
    ("mise.toml", 'run = "uv pipx install x"\n'),
    ("mise.toml", 'run = "uv add pkg"\n'),
    ("mise.toml", 'run = "my-uv pip install"\n'),
    ("mise.toml", 'run = "uv\\npip"\n'),
    ("scripts/setup.sh", "uv\npip install pkg\n"),
)


@pytest.mark.parametrize("file_path", CHECKED_PATHS)
def test_command_files_are_checked(file_path: str) -> None:
    """Verify mise configuration, container builds, scripts, tasks and workflows fall under the check."""
    assert is_checked_path(file_path)


@pytest.mark.parametrize("file_path", UNCHECKED_PATHS)
def test_prose_and_source_files_are_skipped(file_path: str) -> None:
    """Verify documentation, manifests and source files outside command directories are skipped."""
    assert not is_checked_path(file_path)


def write_file(directory: Path, relative_path: str, content: str | bytes) -> str:
    """Write a file under a directory.

    Args:
        directory: Directory that receives the file.
        relative_path: Path of the file inside the directory.
        content: File text, or raw bytes for undecodable content.

    Returns:
        Path of the written file, as a string.
    """
    file_path = directory / relative_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, bytes):
        file_path.write_bytes(content)
    else:
        file_path.write_text(content)

    return str(file_path)


@pytest.mark.parametrize(("relative_path", "content", "line_number"), HITS)
def test_uv_pip_reported(tmp_path: Path, relative_path: str, content: str, line_number: int) -> None:
    """Verify uv pip is reported with its line, whatever whitespace or continuation separates the words."""
    file_path = write_file(tmp_path, relative_path, content)

    report_lines = collect_report_lines(file_path)

    assert len(report_lines) == 1
    assert report_lines[0].startswith(f"{file_path}:{line_number}: uv pip is forbidden: ")


@pytest.mark.parametrize(("relative_path", "content"), MISSES)
def test_other_commands_pass(tmp_path: Path, relative_path: str, content: str) -> None:
    """Verify uv pipx, other uv commands, prefixed words and words split across plain lines pass."""
    assert collect_report_lines(write_file(tmp_path, relative_path, content)) == []


def test_unreadable_file_reported(tmp_path: Path) -> None:
    """Verify a missing file reports the operating system's reason instead of raising."""
    file_path = str(tmp_path / "mise.toml")

    assert collect_report_lines(file_path) == [f"{file_path}: cannot read: No such file or directory"]


def test_undecodable_file_skipped(tmp_path: Path) -> None:
    """Verify a file that is not UTF-8 is skipped instead of reported."""
    file_path = write_file(tmp_path, "scripts/setup.sh", b"\xff\xfe uv pip")

    assert collect_report_lines(file_path) == []


def test_main_skips_unchecked_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Verify a clean run, including a document that names uv pip, exits 0 and prints nothing."""
    monkeypatch.chdir(tmp_path)
    write_file(tmp_path, "README.md", "Never run uv pip install.\n")
    write_file(tmp_path, "mise.toml", 'run = "uv sync --locked"\n')

    assert main(["README.md", "mise.toml"]) == 0
    assert capsys.readouterr().out == ""


def test_main_reports_findings_with_footer(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Verify a finding prints with the policy footer and exits 1."""
    monkeypatch.chdir(tmp_path)
    write_file(tmp_path, "Dockerfile", "RUN uv pip install pkg\n")

    assert main(["Dockerfile"]) == 1
    output = capsys.readouterr().out
    assert "Dockerfile:1: uv pip is forbidden: RUN uv pip install pkg" in output
    assert "docs/patterns/dependency-resolution.md" in output
