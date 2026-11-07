import importlib
import tomllib
from pathlib import Path

import httpx


def load_pyproject(pyproject_path: Path) -> dict[str, object]:
    return tomllib.loads(pyproject_path.read_text())


def extract_project_table(pyproject_path: Path) -> object:
    return load_pyproject(pyproject_path)["project"]


def build_report(report_path: Path) -> str:
    with report_path.open() as report_file:
        return report_file.read()


async def compute_status(client: httpx.AsyncClient, url: str) -> int:
    response = await client.get(url)
    return response.status_code


def parse_module(module_name: str) -> object:
    return importlib.import_module(module_name)
