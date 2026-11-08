from typing import Any


def read_optional_text(path: Any) -> Any:
    return path.read_text() if path.exists() else None
