"""Strict no-comments check for Python files (engineering principle 10).

Run as ``python -m pragmatiks_lint.comments <file> ...``; pre-commit passes the staged Python files.
Every comment is disallowed, trailing comments included, except a shebang on line 1 and an exact bare
tool directive: ``# noqa``, ``# ruff: noqa``, ``# type: ignore``, ``# ty: ignore`` (each with optional
codes) and ``# fmt: off|on|skip``. A directive followed by prose is disallowed; the justification belongs
in the owning docstring. Each disallowed comment prints as ``path:line: comment``. A file that cannot be
tokenized (unterminated string or bracket, inconsistent dedent, invalid encoding) prints as
``path: cannot tokenize: reason`` and counts as a failure; the remaining files are still scanned. Any
printed line is followed by the policy footer and exit status 1; a clean run prints nothing and exits 0.
Running the module imports the ``pragmatiks_lint`` package and its runtime dependencies, so the hook must
run in an environment where ``pragmatiks-lint`` is installed.
"""

from __future__ import annotations

import re
import sys
import tokenize
from pathlib import Path


RULE_CODES = r"[A-Z]+[0-9]+(?:, [A-Z]+[0-9]+)*"
CHECKER_CODES = r"[a-z0-9-]+(?:, ?[a-z0-9-]+)*"
DIRECTIVE = re.compile(
    rf"# noqa(?:: {RULE_CODES})?"
    rf"|# ruff: noqa(?:: {RULE_CODES})?"
    rf"|# (?:type|ty): ignore(?:\[{CHECKER_CODES}\])?"
    r"|# fmt: (?:off|on|skip)"
)
POLICY_FOOTER = (
    "\n"
    "No-comments check failed\n"
    "\n"
    "Policy: no comments (Principle #10). Move rationale worth keeping into the owning docstring.\n"
    "Allowed: a shebang on line 1 and bare tool directives (# noqa, # ruff: noqa, # type: ignore,\n"
    "# ty: ignore, each with optional codes, and # fmt: off|on|skip), with no prose appended.\n"
)


def main(file_paths: list[str]) -> int:
    """Report every disallowed comment and every untokenizable file among the given Python files.

    Prints one line per disallowed comment and per untokenizable file, followed by the policy footer when
    anything was reported; prints nothing when every file is clean.

    Args:
        file_paths: Paths of the Python files to scan.

    Returns:
        0 when every file is clean, 1 otherwise.
    """
    report_lines = [line for file_path in file_paths for line in collect_report_lines(file_path)]
    if not report_lines:
        return 0

    print("\n".join(report_lines))
    print(POLICY_FOOTER)
    return 1


def collect_report_lines(file_path: str) -> list[str]:
    """Collect the report lines for one Python file.

    Args:
        file_path: Path of the Python file to scan.

    Returns:
        One ``path:line: comment`` line per disallowed comment, or a single ``path: cannot tokenize: reason``
        line when the file cannot be tokenized; empty when the file is clean.
    """
    try:
        disallowed_comments = collect_disallowed_comments(Path(file_path))
    except (tokenize.TokenError, SyntaxError) as error:
        return [f"{file_path}: cannot tokenize: {error.args[0]}"]

    return [f"{file_path}:{comment.start[0]}: {comment.string}" for comment in disallowed_comments]


def collect_disallowed_comments(file_path: Path) -> list[tokenize.TokenInfo]:
    """Collect every comment in one Python file that the no-comments rule rejects.

    Args:
        file_path: Python file to scan.

    Returns:
        The disallowed comment tokens in source order; empty when the file is clean.

    Raises:
        OSError: The file cannot be opened or read.
        tokenize.TokenError: The source ends inside an unterminated string or bracket, or contains null bytes.
        SyntaxError: The source has an inconsistent dedent (`IndentationError`) or an invalid or unknown
            encoding declaration.
    """  # noqa: DOC502
    return [comment for comment in load_comments(file_path) if not is_allowed_comment(comment)]


def load_comments(file_path: Path) -> list[tokenize.TokenInfo]:
    """Load every comment token from a Python source file.

    Args:
        file_path: Python file to tokenize.

    Returns:
        The file's comment tokens in source order.

    Raises:
        OSError: The file cannot be opened or read.
        tokenize.TokenError: The source ends inside an unterminated string or bracket, or contains null bytes.
        SyntaxError: The source has an inconsistent dedent (`IndentationError`) or an invalid or unknown
            encoding declaration.
    """  # noqa: DOC502
    with file_path.open("rb") as source:
        return [token for token in tokenize.tokenize(source.readline) if token.type == tokenize.COMMENT]


def is_allowed_comment(comment: tokenize.TokenInfo) -> bool:
    """Tell whether a comment may stay under the no-comments rule.

    Args:
        comment: Comment token produced by `tokenize`.

    Returns:
        True for a shebang on the first line or an exact bare tool directive, False otherwise.
    """
    if comment.start == (1, 0) and comment.string.startswith("#!"):
        return True

    return DIRECTIVE.fullmatch(comment.string.rstrip()) is not None


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
