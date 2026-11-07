import importlib
import os
from pathlib import Path


def load_outputs(module_name: str) -> object:
    return importlib.import_module(module_name)


def get_resolved_path(link_path: Path) -> Path:
    return link_path.resolve()


def read_real_path(link_path: str) -> str:
    return os.path.realpath(link_path)
