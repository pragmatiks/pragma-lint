"""Tests for the strict no-comments check."""

from __future__ import annotations

from pathlib import Path

import pytest

from pragmatiks_lint.comments import collect_disallowed_comments, main


ALLOWED_SOURCES: tuple[str, ...] = (
    "#!/usr/bin/env python3\nvalue = 1\n",
    "import os  # noqa\n",
    "import os  # noqa: F401\n",
    "import os  # noqa: F401, E402\n",
    "# ruff: noqa\nvalue = 1\n",
    "# ruff: noqa: E501\nvalue = 1\n",
    "value: int = 'text'  # type: ignore\n",
    "value: int = 'text'  # type: ignore[assignment]\n",
    "value: int = 'text'  # ty: ignore\n",
    "value: int = 'text'  # ty: ignore[invalid-assignment]\n",
    "# fmt: off\nvalue = [1,2]\n# fmt: on\n",
    "value = [1,2]  # fmt: skip\n",
    "value = '# not a comment'\n",
)

DISALLOWED_SOURCES: tuple[str, ...] = (
    "value = 1\n#!/usr/bin/env python3\n",
    "import os  # noqa: F401 kept for side effects\n",
    "# WHY: the upstream API is eventually consistent\nvalue = 1\n",
    "value = 1  # pragma: no cover\n",
    "value = 1  # trailing note\n",
)

UNTOKENIZABLE_SOURCES: tuple[str, ...] = (
    'value = """unterminated\n',
    "def broken(:\n    pass\n",
    "if True:\n        first = 1\n    second = 2\n",
)


def write_source(directory: Path, source: str) -> Path:
    """Write Python source to a module file inside a directory.

    Args:
        directory: Directory that receives the module.
        source: Python source text.

    Returns:
        Path of the written module.
    """
    module_path = directory / "module.py"
    module_path.write_text(source)
    return module_path


@pytest.mark.parametrize("source", ALLOWED_SOURCES)
def test_allowed_comments_pass(tmp_path: Path, source: str) -> None:
    """Verify shebangs, bare tool directives, and hashes inside strings pass."""
    module_path = write_source(tmp_path, source)

    assert collect_disallowed_comments(module_path) == []


@pytest.mark.parametrize("source", DISALLOWED_SOURCES)
def test_disallowed_comments_fail(tmp_path: Path, source: str) -> None:
    """Verify misplaced shebangs, directives with prose, and ordinary comments fail."""
    module_path = write_source(tmp_path, source)

    assert len(collect_disallowed_comments(module_path)) == 1


def test_main_returns_zero_for_clean_files(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """Verify a clean file exits 0 and prints nothing."""
    module_path = write_source(tmp_path, "value = 1\n")

    assert main([str(module_path)]) == 0
    assert capsys.readouterr().out == ""


def test_main_reports_path_and_line(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """Verify a disallowed comment exits 1 and prints its path and line."""
    module_path = write_source(tmp_path, "value = 1\nother = 2  # planted\n")

    assert main([str(module_path)]) == 1
    assert f"{module_path}:2: # planted" in capsys.readouterr().out


@pytest.mark.parametrize("source", UNTOKENIZABLE_SOURCES)
def test_main_reports_untokenizable_file(tmp_path: Path, capsys: pytest.CaptureFixture[str], source: str) -> None:
    """Verify an untokenizable file exits 1 and prints its path instead of raising."""
    module_path = write_source(tmp_path, source)

    assert main([str(module_path)]) == 1
    assert f"{module_path}: cannot tokenize: " in capsys.readouterr().out


def test_main_keeps_scanning_after_untokenizable_file(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """Verify an untokenizable file does not hide disallowed comments in the files after it."""
    broken_path = tmp_path / "broken.py"
    broken_path.write_text('value = """unterminated\n')
    commented_path = tmp_path / "commented.py"
    commented_path.write_text("value = 1  # planted\n")

    assert main([str(broken_path), str(commented_path)]) == 1
    output = capsys.readouterr().out
    assert f"{broken_path}: cannot tokenize: " in output
    assert f"{commented_path}:1: # planted" in output
