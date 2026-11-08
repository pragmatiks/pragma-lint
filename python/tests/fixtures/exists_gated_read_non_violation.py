from typing import Any


def read_optional_text(path: Any) -> Any:
    if not path.exists():
        return None
    return path.read_text() if path.stat().st_size else ""
