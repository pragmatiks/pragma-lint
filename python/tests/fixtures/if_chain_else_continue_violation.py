from typing import Any


def label_items(items: Any) -> Any:
    labels = []
    for item in items:
        if item.kind == "a":
            label = "alpha"
        elif item.kind == "b":
            label = "beta"
        elif item.kind == "c":
            label = "gamma"
        else:
            continue
        labels.append(label)
    return labels
