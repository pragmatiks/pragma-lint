from typing import Any


async def use_results(wheel: Any, path: Any, parser: Any, future: Any, tools: Any) -> Any:
    result = tools.extract_transaction_return(wheel, "apply")
    tools.handle(tools.parse_resource_id(wheel))
    message = tools.build_message(
        wheel,
        path,
    )
    values = [
        tools.compute_digest(path),
    ]
    tools.build_message(wheel).send()
    parser.parse_args()
    future.exception()
    _, digest = tools.parse_pair(wheel)
    _ = parser.parse_args()
    _ = tools.build_message(wheel)
    return result, message, values, digest
