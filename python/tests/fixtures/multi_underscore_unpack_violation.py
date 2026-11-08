from typing import Any


def select_parts(rows: Any, record: Any) -> Any:
    first, _, _ = rows[0]
    _, middle, _ = record["parts"]
    return first, middle
