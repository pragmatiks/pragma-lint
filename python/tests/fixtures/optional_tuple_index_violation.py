from typing import Any


def describe_field(field: Any, edges: Any, lookup: Any) -> Any:
    key = field[0] if field else None
    value = field[1] if field else None
    blank = field is None or not field[1]
    present = field is not None and field[0] == "x"
    left, right = lookup(edges) or (None, None)
    return key, value, blank, present, left, right
