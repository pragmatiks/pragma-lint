from typing import Any


def select_parts(rows: Any) -> Any:
    first, *_ = rows[0]
    second, _ = rows[1]
    return first, second
