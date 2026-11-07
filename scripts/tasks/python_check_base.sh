#!/usr/bin/env bash
set -euo pipefail

package_directory="$(git rev-parse --show-toplevel)/python"
work_root=$(mktemp -d)
trap 'rm -rf "$work_root"' EXIT

uv build --wheel --project "$package_directory" --out-dir "$work_root/dist"
wheel=$(find "$work_root/dist" -name 'pragmatiks_lint-*.whl')

mkdir -p "$work_root/repository/scripts"
printf '"""Clean module."""\n' > "$work_root/repository/clean.py"
printf '[project]\nname = "clean"\n' > "$work_root/repository/pyproject.toml"
printf '#!/bin/sh\nuv sync --locked\n' > "$work_root/repository/scripts/setup.sh"

cd "$work_root/repository"

run_base() {
  uv run --isolated --no-project --with "$wheel" python "$@"
}

run_base -c '
import importlib.util
import sys

present = [name for name in ("semgrep", "typer", "rich") if importlib.util.find_spec(name) is not None]
if present:
    sys.exit(f"base install carries {present}")
print("base install carries no semgrep, typer or rich")
try:
    import pragmatiks_lint.cli
except ModuleNotFoundError:
    print("pragma.commands entry point needs the check extra, as documented")
else:
    sys.exit("pragmatiks_lint.cli imported without the check extra")
'

run_base -m pragmatiks_lint.comments clean.py
run_base -m pragmatiks_lint.sources pyproject.toml
run_base -m pragmatiks_lint.uv_pip scripts/setup.sh
echo "comments, sources and uv_pip run from the base install"
