from typing import Any


def describe_wheel_version(wheel: Any, wheels: Any, parse_wheel_filename: Any) -> Any:
    version = parse_wheel_filename(wheel)[1]
    name = wheels.extract_name(wheel)[0]
    return version, name
