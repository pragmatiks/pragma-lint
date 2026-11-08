from typing import Any


def describe_wheel_version(wheel: Any, tools: Any) -> Any:
    head = wheel.split(":")[0]
    version, name = tools.parse_wheel_filename(wheel)
    key = tools.parse_name(wheel)["key"]
    return head, version, name, key
