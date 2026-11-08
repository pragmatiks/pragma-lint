from typing import Any


async def apply_schema(self: Any, response: Any, wheel: Any, path: Any, extract_transaction_return: Any) -> Any:
    extract_transaction_return(response, "apply")
    self.parse_resource_id(wheel)
    await compute_digest(path)
    build_message(
        wheel,
        path,
    )


def compute_digest(path: Any) -> Any:
    return path


def build_message(wheel: Any, path: Any) -> Any:
    return wheel, path
