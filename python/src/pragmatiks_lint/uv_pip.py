r"""Reject ``uv pip`` in tracked files that run commands; standard library only.

Run as ``python -m pragmatiks_lint.uv_pip <file> ...``, usually from a pre-commit hook that passes every staged
file. The module owns which files it checks, so a hook needs no ``files:`` filter:

- mise configuration: ``mise.toml``, ``mise.<name>.toml``, ``.mise.toml`` and any ``.toml`` under ``.mise/``;
- container builds: ``Dockerfile``, ``Dockerfile.<name>`` and ``<name>.Dockerfile``;
- shell scripts: ``*.sh`` and ``*.bash``;
- any other file under a ``.mise/tasks``, ``mise-tasks``, ``tasks``, ``scripts`` or ``.github/workflows``
  directory, except prose (``.md``, ``.mdx``, ``.rst``, ``.txt``).

Every other file is skipped, so documentation that forbids ``uv pip`` passes. A finding is ``uv`` and ``pip`` as
whole words separated by spaces, tabs or shell line continuations (``uv \`` then ``pip`` on the next line), and
prints as ``path:line: uv pip is forbidden: <line>``. A file that is not UTF-8 is skipped, since a binary holds
no ``uv pip`` command; one that cannot be read prints as ``path: cannot read: reason`` and counts as a failure.
Any printed line is followed by the policy footer and exit status 1; a clean run prints nothing and exits 0.
"""

from __future__ import annotations

import re
import sys
from pathlib import PurePosixPath

from pragmatiks_lint.report import print_report


UV_PIP_PATTERN = re.compile(r"(?<![\w-])uv(?:[ \t]|\\\r?\n)+pip(?![\w-])")
SHELL_SUFFIXES = frozenset({".sh", ".bash"})
PROSE_SUFFIXES = frozenset({".md", ".mdx", ".rst", ".txt"})
COMMAND_DIRECTORIES = (
    (".mise", "tasks"),
    ("mise-tasks",),
    ("tasks",),
    ("scripts",),
    (".github", "workflows"),
)
POLICY_FOOTER = (
    "\n"
    "uv pip check failed\n"
    "\n"
    "Policy: dependencies are declared in manifests and installed from the lockfile; never run uv pip.\n"
    "See docs/patterns/dependency-resolution.md in the pragma-os repository.\n"
)


def main(file_paths: list[str]) -> int:
    """Report every ``uv pip`` among the checked files of the given paths.

    Args:
        file_paths: Paths of files to consider, relative to the repository root; unchecked files are skipped.

    Returns:
        0 when every checked file is clean, 1 otherwise.
    """
    report_lines = [
        line for file_path in file_paths if is_checked_path(file_path) for line in collect_report_lines(file_path)
    ]
    return print_report(report_lines, POLICY_FOOTER)


def is_checked_path(file_path: str) -> bool:
    """Tell whether a file is one that runs commands and so falls under the check.

    Args:
        file_path: Path of a file, relative to the repository root.

    Returns:
        True for mise configuration, container builds, shell scripts and non-prose files under a task, script
        or workflow directory; False otherwise.
    """
    path = PurePosixPath(file_path.replace("\\", "/"))
    name = path.name
    suffix = path.suffix.lower()
    if is_mise_configuration(path) or suffix in SHELL_SUFFIXES:
        return True

    if name.startswith("Dockerfile") or name.endswith(".Dockerfile"):
        return True

    return suffix not in PROSE_SUFFIXES and is_under_command_directory(path)


def is_mise_configuration(path: PurePosixPath) -> bool:
    """Tell whether a path is a mise configuration file.

    Args:
        path: Path of a file, relative to the repository root.

    Returns:
        True for ``mise.toml``, ``mise.<name>.toml``, ``.mise.toml`` and any ``.toml`` under a ``.mise`` directory.
    """
    if path.suffix != ".toml":
        return False

    return path.name.startswith(("mise.", ".mise.")) or ".mise" in path.parent.parts


def is_under_command_directory(path: PurePosixPath) -> bool:
    """Tell whether a path lies under a task, script or workflow directory.

    Args:
        path: Path of a file, relative to the repository root.

    Returns:
        True when the path's parent directories contain one of the command directory sequences.
    """
    parts = path.parent.parts
    return any(
        parts[index : index + len(directory)] == directory
        for directory in COMMAND_DIRECTORIES
        for index in range(len(parts))
    )


def collect_report_lines(file_path: str) -> list[str]:
    """Collect the report lines for one file.

    Args:
        file_path: Path of the file to scan.

    Returns:
        One ``path:line: uv pip is forbidden: <line>`` line per finding, or a single ``cannot read`` line; empty
        when the file is clean or is not UTF-8.
    """
    try:
        with open(file_path, encoding="utf-8") as file:
            text = file.read()
    except UnicodeDecodeError:
        return []
    except OSError as error:
        return [f"{file_path}: cannot read: {error.strerror or error}"]

    return [f"{file_path}:{line_number}: uv pip is forbidden: {line}" for line_number, line in find_uv_pip(text)]


def find_uv_pip(text: str) -> list[tuple[int, str]]:
    """Find every ``uv pip`` in a file's text.

    Args:
        text: The file's content.

    Returns:
        The one-based line number where each finding starts and that line stripped, in file order.
    """
    lines = text.splitlines()
    findings = []
    for match in UV_PIP_PATTERN.finditer(text):
        line_index = text.count("\n", 0, match.start())
        findings.append((line_index + 1, lines[line_index].strip()))
    return findings


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
