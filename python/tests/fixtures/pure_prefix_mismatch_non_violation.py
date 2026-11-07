import asyncio
import typing

import httpx


def derive_origin(annotation: object) -> object:
    return typing.get_origin(annotation)


def extract_value(payload: dict[str, int]) -> int | None:
    return payload.get("value")


def build_headers(content_length: int) -> httpx.Headers:
    return httpx.Headers({"Content-Length": str(content_length)})


async def format_label(name: str) -> str:
    await asyncio.sleep(0)
    return name.upper()
