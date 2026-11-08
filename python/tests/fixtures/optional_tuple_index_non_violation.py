from typing import Any


def describe_field(field: Any, lines: Any) -> Any:
    key = field[0] if field else None
    if not lines or lines[0] != "---":
        return None
    kept = [line for line in lines if line[0] != "#"]
    return key, kept
