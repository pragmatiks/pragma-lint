import os


def resolve_token() -> str | None:
    return os.getenv("PRAGMA_TOKEN")
