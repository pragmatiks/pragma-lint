from typing import Any


async def apply_schema(self: Any, cls: Any, wheel: Any, path: Any, extract_transaction_return: Any) -> Any:
    extract_transaction_return(wheel, "apply")
    self.parse_resource_id(wheel)
    await compute_digest(path)
    build_message(
        wheel,
        path,
    )
    _ = parse_resource_id(wheel)
    _ = await self.compute_digest(path)
    _ = cls.build_message(wheel, path)


def compute_digest(path: Any) -> Any:
    return path


def build_message(wheel: Any, path: Any) -> Any:
    return wheel, path


def parse_resource_id(wheel: Any) -> Any:
    return wheel
