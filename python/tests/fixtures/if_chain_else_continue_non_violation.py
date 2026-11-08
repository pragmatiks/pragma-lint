from typing import Any


def label_items(items: Any) -> Any:
    labels = []
    for item in items:
        if item.kind == "a":
            label = "alpha"
        else:
            label = "other"
        labels.append(label)
    return labels
