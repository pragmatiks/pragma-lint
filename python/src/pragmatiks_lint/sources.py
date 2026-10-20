"""Dependency source check for committed manifests: no declared path may leave the repository.

Run as ``python -m pragmatiks_lint.sources <manifest> ...`` from the repository root. The current working directory
is the repository every declared path must stay inside. Checked declarations:

- ``pyproject.toml``: each ``tool.uv.sources`` entry (a table or a list of tables) passes only with
  ``workspace = true`` or a ``path`` inside the repository; git, url and index sources, and tables with neither
  key, are rejected. Each ``tool.uv.workspace.members`` and ``tool.uv.workspace.exclude`` entry and each
  ``tool.ty.environment.extra-paths`` entry must be inside the repository; a glob is judged with its wildcards
  taken literally, so ``packages/*`` passes and ``../*`` fails. uv takes ``~`` literally, so a uv source or
  workspace path starting with ``~/`` names a directory inside the manifest's directory.
- ``package.json``: values in ``dependencies``, ``devDependencies``, ``optionalDependencies`` and
  ``peerDependencies`` written as a ``file:`` or ``link:`` spec, or as a bare path (``.``, ``..``, or starting
  with ``./``, ``../``, ``/`` or ``~/``), must be inside the repository; ``workspace:``, registry, alias and git
  specs pass. A location starting with ``~/`` resolves against the home directory, as pnpm expands it.
- ``pnpm-workspace.yaml``: ``catalog``, every catalog under ``catalogs``, and ``overrides`` values, under the same
  rule as ``package.json``; each ``packages`` entry, with a leading ``!`` dropped, must be inside the repository
  under the same glob rule as the uv workspace members.

A relative path resolves against its manifest's directory with symlinks followed, so an in-repository link that
points outside fails, and a path that does not exist on disk is still judged by where it would resolve. Each
violation prints as ``path: key = value reason``. A manifest that cannot be opened or read prints as
``path: cannot read: reason``; one that cannot be decoded or parsed, or whose file name is none of the three
above, prints as ``path: cannot parse: reason``. Both count as failures, and the remaining manifests are still
checked. Any printed line is followed by the policy footer and exit status 1; a clean run prints nothing and exits
0. Running the module imports the ``pragmatiks_lint`` package and its runtime dependencies (PyYAML parses
``pnpm-workspace.yaml``), so the hook must run where ``pragmatiks-lint`` is installed.
"""

from __future__ import annotations

import json
import sys
import tomllib
from dataclasses import dataclass, replace
from pathlib import Path

import yaml

from pragmatiks_lint.report import print_report


PACKAGE_DEPENDENCY_FIELDS = ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies")
PATH_PROTOCOLS = ("file:", "link:")
HOME_PREFIX = "~/"
BARE_PATH_PREFIXES = ("./", "../", "/", HOME_PREFIX)
BARE_PATHS = frozenset({".", ".."})
WORKSPACE_PACKAGE_NEGATION = "!"
POLICY_FOOTER = (
    "\n"
    "Dependency source check failed\n"
    "\n"
    "Policy: every path a committed manifest declares must resolve inside the repository, and each\n"
    "tool.uv.sources entry must be a workspace member or such a path. Never commit a path to a sibling checkout.\n"
    "See docs/patterns/dependency-resolution.md in the pragma-os repository.\n"
)


@dataclass(frozen=True)
class DeclaredPath:
    """A manifest value that names a filesystem location.

    Attributes:
        key_path: Dotted location of the value inside the manifest.
        value: The value as written in the manifest.
        path: The filesystem location the value names, without any ``file:`` or ``link:`` prefix; relative to the
            manifest's directory as collected, absolute with symlinks followed once resolved.
    """

    key_path: str
    value: str
    path: Path

    def describe_violation(self) -> str:
        """Describe this declaration as a violation of the policy.

        Returns:
            The key path, the value as written, and why it fails.
        """
        return f"{self.key_path} = {json.dumps(self.value)} resolves outside the repository"


@dataclass(frozen=True)
class RejectedSource:
    """A uv source that is neither a workspace member nor a path.

    Attributes:
        key_path: Dotted location of the source inside the manifest.
        source: The source entry as parsed from the manifest.
    """

    key_path: str
    source: object

    def describe_violation(self) -> str:
        """Describe this source as a violation of the policy.

        Returns:
            The key path, the source as written, and why it fails.
        """
        rendered_source = json.dumps(self.source, default=str)
        return f"{self.key_path} = {rendered_source} is neither a workspace member nor a path inside the repository"


type Declaration = DeclaredPath | RejectedSource


def main(file_paths: list[str]) -> int:
    """Report every declared path that leaves the repository among the given manifests.

    The current working directory, with symlinks followed, is taken as the repository root, and ``~/`` in a
    ``package.json`` or ``pnpm-workspace.yaml`` location expands to the current user's home directory. Prints one
    line per violation and per unreadable or unparsable manifest, followed by the policy footer when anything was
    reported; prints nothing when every manifest is clean.

    Args:
        file_paths: Paths of the ``pyproject.toml``, ``package.json`` and ``pnpm-workspace.yaml`` files to check.

    Returns:
        0 when every manifest is clean, 1 otherwise.
    """
    repository_root = Path.cwd().resolve()
    home_directory = Path.home()
    report_lines = [
        line for file_path in file_paths for line in collect_report_lines(file_path, repository_root, home_directory)
    ]
    return print_report(report_lines, POLICY_FOOTER)


def collect_report_lines(file_path: str, repository_root: Path, home_directory: Path) -> list[str]:
    """Collect the report lines for one manifest.

    Args:
        file_path: Path of the manifest to check.
        repository_root: Absolute directory, with symlinks followed, that every declared path must resolve inside.
        home_directory: Directory a ``~/`` location in a ``package.json`` or ``pnpm-workspace.yaml`` expands to.

    Returns:
        One ``path: key = value reason`` line per violation, or a single ``path: cannot read: reason`` or
        ``path: cannot parse: reason`` line when the manifest cannot be read or parsed; empty when the manifest is
        clean.
    """
    manifest_path = Path(file_path)
    try:
        declarations = load_declarations(manifest_path, home_directory)
    except OSError as error:
        return [f"{file_path}: cannot read: {error.strerror or error}"]
    except (ValueError, yaml.YAMLError) as error:
        return [f"{file_path}: cannot parse: {' '.join(str(error).split())}"]

    resolved_declarations = [resolve_declaration(declaration, manifest_path.parent) for declaration in declarations]
    return [
        f"{file_path}: {declaration.describe_violation()}"
        for declaration in resolved_declarations
        if is_violation(declaration, repository_root)
    ]


def load_declarations(manifest_path: Path, home_directory: Path) -> list[Declaration]:
    """Load the path and source declarations of one manifest, choosing its format by file name.

    Args:
        manifest_path: A ``pyproject.toml``, ``package.json`` or ``pnpm-workspace.yaml`` file.
        home_directory: Directory a ``~/`` location in a ``package.json`` or ``pnpm-workspace.yaml`` expands to.

    Returns:
        The declarations the policy checks, in manifest order, with paths as collected.

    Raises:
        OSError: The file cannot be opened or read.
        ValueError: The file is not valid UTF-8, is not valid TOML or JSON, or has an unsupported file name.
        yaml.YAMLError: A ``pnpm-workspace.yaml`` file is not valid YAML.
    """  # noqa: DOC502
    text = manifest_path.read_text(encoding="utf-8")
    match manifest_path.name:
        case "pyproject.toml":
            return collect_pyproject_declarations(tomllib.loads(text))
        case "package.json":
            return collect_package_json_declarations(json.loads(text), home_directory)
        case "pnpm-workspace.yaml":
            return collect_pnpm_workspace_declarations(yaml.safe_load(text), home_directory)

    raise ValueError("not a pyproject.toml, package.json or pnpm-workspace.yaml file")


def resolve_declaration(declaration: Declaration, manifest_directory: Path) -> Declaration:
    """Resolve a declared path on disk against its manifest's directory, following every symlink.

    Args:
        declaration: A declaration as collected from a manifest.
        manifest_directory: Directory of the manifest, which relative paths resolve against.

    Returns:
        A declared path with its path made absolute and symlinks followed, components that do not exist kept as
        written; a rejected source unchanged.
    """
    match declaration:
        case DeclaredPath(path=path):
            return replace(declaration, path=(manifest_directory / path).resolve())
        case RejectedSource():
            return declaration


def collect_pyproject_declarations(document: object) -> list[Declaration]:
    """Collect the uv sources, uv workspace paths and ty extra paths of a parsed ``pyproject.toml``.

    Args:
        document: The parsed TOML document.

    Returns:
        Every non-workspace uv source, every uv workspace member and exclude, and every ty extra path, in that order.
    """
    tool = find_mapping(document, "tool")
    uv = find_mapping(tool, "uv")
    uv_workspace = find_mapping(uv, "workspace")
    ty_environment = find_mapping(find_mapping(tool, "ty"), "environment")
    return [
        *collect_uv_source_declarations(find_mapping(uv, "sources")),
        *collect_path_list_declarations("tool.uv.workspace.members", find_list(uv_workspace, "members")),
        *collect_path_list_declarations("tool.uv.workspace.exclude", find_list(uv_workspace, "exclude")),
        *collect_path_list_declarations("tool.ty.environment.extra-paths", find_list(ty_environment, "extra-paths")),
    ]


def collect_uv_source_declarations(sources: dict[str, object]) -> list[Declaration]:
    """Collect the uv sources that are not workspace members.

    Args:
        sources: The ``tool.uv.sources`` table, mapping each package name to a source table or list of tables.

    Returns:
        A declared path for each ``path`` source and a rejected source for every other non-workspace source.
    """
    return [
        declaration
        for name, entry in sources.items()
        for declaration in build_uv_entry_declarations(f"tool.uv.sources.{name}", entry)
    ]


def build_uv_entry_declarations(key_path: str, entry: object) -> list[Declaration]:
    """Build the declarations one ``tool.uv.sources`` entry contributes.

    Args:
        key_path: Key path of the entry.
        entry: A source table, or a list of source tables with markers.

    Returns:
        The declarations of every source table in the entry, in order.
    """
    return [
        declaration
        for source_key_path, source in enumerate_uv_source_tables(key_path, entry)
        for declaration in build_uv_source_declarations(source_key_path, source)
    ]


def enumerate_uv_source_tables(key_path: str, entry: object) -> list[tuple[str, object]]:
    """Pair each source table of one uv source entry with its key path.

    Args:
        key_path: Key path of the entry.
        entry: A source table, or a list of source tables with markers.

    Returns:
        The entry itself under its key path, or each listed table under an indexed key path.
    """
    if isinstance(entry, list):
        return [(f"{key_path}[{index}]", source) for index, source in enumerate(entry)]

    return [(key_path, entry)]


def build_uv_source_declarations(key_path: str, source: object) -> list[Declaration]:
    """Build the declarations one uv source table contributes.

    Args:
        key_path: Key path of the source table.
        source: The source table as parsed.

    Returns:
        Nothing for a workspace source, a declared path for a ``path`` source, and a rejected source otherwise.
    """
    if not isinstance(source, dict):
        return [RejectedSource(key_path=key_path, source=source)]

    if source.get("workspace") is True:
        return []

    path = source.get("path")
    if isinstance(path, str):
        return [DeclaredPath(key_path=f"{key_path}.path", value=path, path=Path(path))]

    return [RejectedSource(key_path=key_path, source=source)]


def collect_path_list_declarations(key_path: str, entries: list[object]) -> list[Declaration]:
    """Collect a list of paths or path globs.

    Args:
        key_path: Key path of the list.
        entries: The list as parsed.

    Returns:
        A declared path for each string entry, under an indexed key path.
    """
    return [
        DeclaredPath(key_path=f"{key_path}[{index}]", value=entry, path=Path(entry))
        for index, entry in enumerate(entries)
        if isinstance(entry, str)
    ]


def collect_package_json_declarations(document: object, home_directory: Path) -> list[Declaration]:
    """Collect the path specs of a parsed ``package.json``.

    Args:
        document: The parsed JSON document.
        home_directory: Directory a ``~/`` location expands to.

    Returns:
        A declared path for each path spec in the four dependency fields.
    """
    return [
        declaration
        for field in PACKAGE_DEPENDENCY_FIELDS
        for declaration in collect_specifier_declarations(field, find_mapping(document, field), home_directory)
    ]


def collect_pnpm_workspace_declarations(document: object, home_directory: Path) -> list[Declaration]:
    """Collect the workspace packages and path specs of a parsed ``pnpm-workspace.yaml``.

    Args:
        document: The parsed YAML document; ``None`` for an empty file.
        home_directory: Directory a ``~/`` location expands to.

    Returns:
        A declared path for each ``packages`` entry, then for each path spec in ``catalog``, ``catalogs`` and
        ``overrides``.
    """
    return [
        *collect_workspace_package_declarations(find_list(document, "packages")),
        *collect_specifier_declarations("catalog", find_mapping(document, "catalog"), home_directory),
        *collect_named_catalog_declarations(find_mapping(document, "catalogs"), home_directory),
        *collect_specifier_declarations("overrides", find_mapping(document, "overrides"), home_directory),
    ]


def collect_workspace_package_declarations(packages: list[object]) -> list[Declaration]:
    """Collect the package globs of a ``pnpm-workspace.yaml``.

    Args:
        packages: The ``packages`` list as parsed.

    Returns:
        A declared path for each string entry, with a leading ``!`` dropped so an exclusion is judged by the
        location it names.
    """
    return [
        DeclaredPath(
            key_path=f"packages[{index}]", value=entry, path=Path(entry.removeprefix(WORKSPACE_PACKAGE_NEGATION))
        )
        for index, entry in enumerate(packages)
        if isinstance(entry, str)
    ]


def collect_named_catalog_declarations(catalogs: dict[str, object], home_directory: Path) -> list[Declaration]:
    """Collect the path specs of every named catalog in a ``pnpm-workspace.yaml``.

    Args:
        catalogs: The ``catalogs`` map from catalog name to a map from package name to specifier.
        home_directory: Directory a ``~/`` location expands to.

    Returns:
        A declared path for each path spec, under the key path ``catalogs.<name>.<package>``.
    """
    return [
        declaration
        for name in catalogs
        for declaration in collect_specifier_declarations(
            f"catalogs.{name}", find_mapping(catalogs, name), home_directory
        )
    ]


def collect_specifier_declarations(
    field: str, specifiers: dict[str, object], home_directory: Path
) -> list[Declaration]:
    """Collect the path specs of one map from package name to version specifier.

    Args:
        field: Key path of the map, used as the leading key path segments.
        specifiers: The map from package name to specifier.
        home_directory: Directory a ``~/`` location expands to.

    Returns:
        A declared path for each specifier that names a filesystem location.
    """
    return [
        DeclaredPath(key_path=f"{field}.{name}", value=specifier, path=build_specifier_path(location, home_directory))
        for name, specifier in specifiers.items()
        if isinstance(specifier, str) and (location := parse_specifier_location(specifier)) is not None
    ]


def parse_specifier_location(specifier: str) -> str | None:
    """Extract the filesystem location a package specifier names.

    Args:
        specifier: A ``package.json`` or ``pnpm-workspace.yaml`` version specifier.

    Returns:
        The location of a ``file:`` or ``link:`` spec or of a bare path, or None for any other specifier. A
        semver range such as ``~1.2.3`` is not a path; only ``~/`` starts one.
    """
    for protocol in PATH_PROTOCOLS:
        if specifier.startswith(protocol):
            return specifier.removeprefix(protocol)

    if specifier in BARE_PATHS or specifier.startswith(BARE_PATH_PREFIXES):
        return specifier

    return None


def build_specifier_path(location: str, home_directory: Path) -> Path:
    """Build the path a package specifier location names, expanding a leading ``~/`` as pnpm does.

    Args:
        location: A location extracted from a specifier.
        home_directory: Directory a leading ``~/`` expands to.

    Returns:
        The location under the home directory when it starts with ``~/``, otherwise the location as written.
    """
    if location.startswith(HOME_PREFIX):
        return home_directory / location.removeprefix(HOME_PREFIX)

    return Path(location)


def find_mapping(container: object, key: str) -> dict[str, object]:
    """Find a nested table in a parsed document.

    Args:
        container: A parsed table, or any other parsed value.
        key: Key of the nested table.

    Returns:
        The nested table, or an empty table when the container is not a table or the key holds no table.
    """
    if not isinstance(container, dict):
        return {}

    value = container.get(key)
    return value if isinstance(value, dict) else {}


def find_list(container: object, key: str) -> list[object]:
    """Find a nested list in a parsed document.

    Args:
        container: A parsed table, or any other parsed value.
        key: Key of the nested list.

    Returns:
        The nested list, or an empty list when the container is not a table or the key holds no list.
    """
    if not isinstance(container, dict):
        return []

    value = container.get(key)
    return value if isinstance(value, list) else []


def is_violation(declaration: Declaration, repository_root: Path) -> bool:
    """Tell whether a resolved declaration breaks the policy.

    Args:
        declaration: A declaration whose path, if any, is already resolved.
        repository_root: Absolute directory, with symlinks followed, that every declared path must resolve inside.

    Returns:
        True for a rejected source or a path outside the repository root, False otherwise.
    """
    match declaration:
        case DeclaredPath(path=path):
            return not path.is_relative_to(repository_root)
        case RejectedSource():
            return True


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
