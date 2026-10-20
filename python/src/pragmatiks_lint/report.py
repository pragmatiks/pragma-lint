"""Print a check's report lines and policy footer, and map the report to a hook exit status; standard library only."""

from __future__ import annotations


def print_report(report_lines: list[str], policy_footer: str) -> int:
    """Print a check's report lines followed by its policy footer; print nothing for an empty report.

    Args:
        report_lines: One line per finding, in the order the check produced them.
        policy_footer: Policy text printed after the report lines.

    Returns:
        0 when the report is empty, 1 otherwise.
    """
    if not report_lines:
        return 0

    print("\n".join(report_lines))
    print(policy_footer)
    return 1
