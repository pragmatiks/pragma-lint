"""Tests for the dependency source check."""

from __future__ import annotations

from pathlib import Path

import pytest

from pragmatiks_lint.sources import collect_report_lines, main


OUTSIDE = "resolves outside the repository"
NOT_WORKSPACE_OR_PATH = "is neither a workspace member nor a path inside the repository"

ALLOWED_MANIFESTS: tuple[tuple[str, str], ...] = (
    ("pyproject.toml", '[project]\nname = "member"\n'),
    ("pyproject.toml", "[tool.uv.sources]\npragma-api = { workspace = true }\n"),
    ("pyproject.toml", '[tool.uv.sources]\nshared = { path = "../shared", editable = true }\n'),
    ("pyproject.toml", '[tool.uv.sources]\nshared = [{ path = "../shared", marker = "sys_platform == \'linux\'" }]\n'),
    ("pyproject.toml", '[tool.uv.sources]\nliteral = { path = "~/pragma-sdk" }\n'),
    ("pyproject.toml", '[tool.uv.workspace]\nmembers = ["packages/*", "../shared"]\nexclude = ["packages/legacy"]\n'),
    ("pyproject.toml", '[tool.ty.environment]\nextra-paths = ["src", "../shared/src"]\n'),
    ("package.json", '{"dependencies": {"react": "^19.0.0", "lint": "workspace:*", "tilde": "~1.2.3"}}'),
    ("package.json", '{"devDependencies": {"shared": "file:../shared", "linked": "link:../shared"}}'),
    ("package.json", '{"dependencies": {"alias": "npm:react@19", "remote": "github:owner/name"}}'),
    ("package.json", '{"peerDependencies": {"shared": "../shared"}}'),
    ("package.json", '{"dependencies": {"home": "file:~/repository/packages/shared"}}'),
    ("package.json", '{"overrides": {"shared": "file:../../sibling"}, "resolutions": {"x": "link:../../sibling"}}'),
    ("package.json", "[]"),
    ("pnpm-workspace.yaml", ""),
    ("pnpm-workspace.yaml", "packages:\n  - packages/*\n  - '!packages/legacy'\n"),
    ("pnpm-workspace.yaml", "overrides:\n  shared: link:../shared\n  react: ^19.0.0\n"),
    ("pnpm-workspace.yaml", "catalog:\n  react: ^19.0.0\n  shared: link:../shared\n"),
    ("pnpm-workspace.yaml", "catalogs:\n  react19:\n    react: ^19.0.0\n    shared: file:../shared\n"),
)

DISALLOWED_MANIFESTS: tuple[tuple[str, str, str], ...] = (
    (
        "pyproject.toml",
        '[tool.uv.sources]\npragmatiks-sdk = { path = "../../../pragma-sdk", editable = true }\n',
        f'tool.uv.sources.pragmatiks-sdk.path = "../../../pragma-sdk" {OUTSIDE}',
    ),
    (
        "pyproject.toml",
        '[tool.ty.environment]\nextra-paths = ["../pragma-sdk/src"]\n',
        f'tool.ty.environment.extra-paths[0] = "../pragma-sdk/src" {OUTSIDE}',
    ),
    (
        "pyproject.toml",
        '[tool.uv.sources]\npragmatiks-sdk = [{ path = "../../pragma-sdk", marker = "python_version >= \'3.13\'" }]\n',
        f'tool.uv.sources.pragmatiks-sdk[0].path = "../../pragma-sdk" {OUTSIDE}',
    ),
    (
        "pyproject.toml",
        '[tool.uv.sources]\npragmatiks-sdk = { git = "https://github.com/pragmatiks/sdk" }\n',
        f'tool.uv.sources.pragmatiks-sdk = {{"git": "https://github.com/pragmatiks/sdk"}} {NOT_WORKSPACE_OR_PATH}',
    ),
    (
        "pyproject.toml",
        '[tool.uv.sources]\npragmatiks-sdk = { url = "https://example.com/sdk-1.0.0.whl" }\n',
        f'tool.uv.sources.pragmatiks-sdk = {{"url": "https://example.com/sdk-1.0.0.whl"}} {NOT_WORKSPACE_OR_PATH}',
    ),
    (
        "pyproject.toml",
        '[tool.uv.sources]\npragmatiks-sdk = { index = "internal" }\n',
        f'tool.uv.sources.pragmatiks-sdk = {{"index": "internal"}} {NOT_WORKSPACE_OR_PATH}',
    ),
    (
        "pyproject.toml",
        '[tool.uv.workspace]\nmembers = ["packages/*", "../pytarget"]\n',
        f'tool.uv.workspace.members[1] = "../pytarget" {OUTSIDE}',
    ),
    (
        "pyproject.toml",
        '[tool.uv.workspace]\nmembers = ["packages/*"]\nexclude = ["../*"]\n',
        f'tool.uv.workspace.exclude[0] = "../*" {OUTSIDE}',
    ),
    (
        "package.json",
        '{"devDependencies": {"@pragmatiks/lint": "file:../../pragma-lint/js"}}',
        f'devDependencies.@pragmatiks/lint = "file:../../pragma-lint/js" {OUTSIDE}',
    ),
    (
        "package.json",
        '{"dependencies": {"sibling": "link:../../sibling"}}',
        f'dependencies.sibling = "link:../../sibling" {OUTSIDE}',
    ),
    (
        "package.json",
        '{"optionalDependencies": {"sibling": "../../sibling"}}',
        f'optionalDependencies.sibling = "../../sibling" {OUTSIDE}',
    ),
    (
        "package.json",
        '{"dependencies": {"sdk": "file:~/pragma-sdk"}}',
        f'dependencies.sdk = "file:~/pragma-sdk" {OUTSIDE}',
    ),
    (
        "package.json",
        '{"dependencies": {"sdk": "~/pragma-sdk"}}',
        f'dependencies.sdk = "~/pragma-sdk" {OUTSIDE}',
    ),
    (
        "package.json",
        '{"devDependencies": {"sdk": "link:~/pragma-sdk"}}',
        f'devDependencies.sdk = "link:~/pragma-sdk" {OUTSIDE}',
    ),
    (
        "pnpm-workspace.yaml",
        "overrides:\n  '@pragmatiks/lint': link:../../pragma-lint/js\n",
        f'overrides.@pragmatiks/lint = "link:../../pragma-lint/js" {OUTSIDE}',
    ),
    (
        "pnpm-workspace.yaml",
        "packages:\n  - '.'\n  - ../target\n",
        f'packages[1] = "../target" {OUTSIDE}',
    ),
    (
        "pnpm-workspace.yaml",
        "packages:\n  - '!../target'\n",
        f'packages[0] = "!../target" {OUTSIDE}',
    ),
    (
        "pnpm-workspace.yaml",
        "catalog:\n  target: link:../target\n",
        f'catalog.target = "link:../target" {OUTSIDE}',
    ),
    (
        "pnpm-workspace.yaml",
        "catalogs:\n  react19:\n    target: file:../target\n",
        f'catalogs.react19.target = "file:../target" {OUTSIDE}',
    ),
    (
        "pnpm-workspace.yaml",
        "overrides:\n  sdk: ~/pragma-sdk\n",
        f'overrides.sdk = "~/pragma-sdk" {OUTSIDE}',
    ),
)

UNPARSABLE_MANIFESTS: tuple[tuple[str, bytes], ...] = (
    ("pyproject.toml", b"[tool.uv.sources\n"),
    ("package.json", b'{"dependencies": '),
    ("pnpm-workspace.yaml", b"overrides: [unclosed\n"),
    ("pyproject.toml", b"\xff\xfe invalid utf-8"),
    ("requirements.txt", b"pragmatiks-sdk\n"),
)


@pytest.fixture
def home_directory(tmp_path: Path) -> Path:
    """Use the directory holding the repository and the sibling checkout as the home directory.

    Args:
        tmp_path: Pytest temporary directory.

    Returns:
        The temporary directory, absolute with symlinks followed.
    """
    return tmp_path.resolve()


@pytest.fixture
def repository_root(home_directory: Path) -> Path:
    """Create a repository directory with one member package next to an empty sibling checkout.

    Args:
        home_directory: Directory that holds the repository and the sibling.

    Returns:
        The repository root, containing ``packages/member`` and ``packages/shared``.
    """
    root = home_directory / "repository"
    (root / "packages" / "member").mkdir(parents=True)
    (root / "packages" / "shared").mkdir(parents=True)
    (home_directory / "pragma-sdk").mkdir()
    return root


def write_manifest(directory: Path, file_name: str, content: str | bytes) -> Path:
    """Write a manifest file inside a directory.

    Args:
        directory: Directory that receives the manifest.
        file_name: File name of the manifest.
        content: Manifest text, or raw bytes for undecodable content.

    Returns:
        Path of the written manifest.
    """
    manifest_path = directory / file_name
    if isinstance(content, bytes):
        manifest_path.write_bytes(content)
    else:
        manifest_path.write_text(content)

    return manifest_path


@pytest.mark.parametrize(("file_name", "content"), ALLOWED_MANIFESTS)
def test_allowed_manifests_pass(repository_root: Path, home_directory: Path, file_name: str, content: str) -> None:
    """Verify workspace sources, registry specs, and paths inside the repository pass."""
    manifest_path = write_manifest(repository_root / "packages" / "member", file_name, content)

    assert collect_report_lines(str(manifest_path), repository_root, home_directory) == []


@pytest.mark.parametrize(("file_name", "content", "expected"), DISALLOWED_MANIFESTS)
def test_disallowed_manifests_fail(
    repository_root: Path, home_directory: Path, file_name: str, content: str, expected: str
) -> None:
    """Verify sibling paths, home paths, outside workspace members and non-path uv sources fail by key."""
    manifest_path = write_manifest(repository_root, file_name, content)

    assert collect_report_lines(str(manifest_path), repository_root, home_directory) == [f"{manifest_path}: {expected}"]


def test_absolute_sibling_path_fails(repository_root: Path, home_directory: Path) -> None:
    """Verify an absolute path to a sibling checkout fails, as written by ``uv add --editable /abs/path``."""
    sibling = repository_root.parent / "pragma-sdk"
    content = f'[tool.uv.sources]\npragmatiks-sdk = {{ path = "{sibling}", editable = true }}\n'
    manifest_path = write_manifest(repository_root, "pyproject.toml", content)

    assert collect_report_lines(str(manifest_path), repository_root, home_directory) == [
        f'{manifest_path}: tool.uv.sources.pragmatiks-sdk.path = "{sibling}" {OUTSIDE}'
    ]


def test_absolute_path_inside_repository_passes(repository_root: Path, home_directory: Path) -> None:
    """Verify an absolute path that lies inside the repository passes."""
    shared = repository_root / "packages" / "shared"
    content = f'[tool.uv.sources]\nshared = {{ path = "{shared}" }}\n'
    manifest_path = write_manifest(repository_root, "pyproject.toml", content)

    assert collect_report_lines(str(manifest_path), repository_root, home_directory) == []


def test_symlink_escaping_repository_fails(repository_root: Path, home_directory: Path) -> None:
    """Verify an in-repository symlink pointing at a sibling checkout fails."""
    (repository_root / "vendor-sdk").symlink_to(repository_root.parent / "pragma-sdk")
    content = '[tool.uv.sources]\npragmatiks-sdk = { path = "vendor-sdk" }\n'
    manifest_path = write_manifest(repository_root, "pyproject.toml", content)

    assert len(collect_report_lines(str(manifest_path), repository_root, home_directory)) == 1


def test_missing_sibling_fails(repository_root: Path, home_directory: Path) -> None:
    """Verify a sibling path that does not exist on disk still fails, as on a CI runner."""
    content = '[tool.uv.sources]\npragma-cli = { path = "../pragma-cli" }\n'
    manifest_path = write_manifest(repository_root, "pyproject.toml", content)

    assert len(collect_report_lines(str(manifest_path), repository_root, home_directory)) == 1


@pytest.mark.parametrize(("file_name", "content"), UNPARSABLE_MANIFESTS)
def test_unparsable_manifest_reported(
    repository_root: Path, home_directory: Path, file_name: str, content: bytes
) -> None:
    """Verify an undecodable, malformed, or unsupported manifest reports instead of raising."""
    manifest_path = write_manifest(repository_root, file_name, content)

    report_lines = collect_report_lines(str(manifest_path), repository_root, home_directory)

    assert len(report_lines) == 1
    assert report_lines[0].startswith(f"{manifest_path}: cannot parse: ")
    assert "\n" not in report_lines[0]


def test_unreadable_manifest_reported(repository_root: Path, home_directory: Path) -> None:
    """Verify a manifest missing from disk reports the operating system's reason instead of raising."""
    manifest_path = repository_root / "package.json"

    assert collect_report_lines(str(manifest_path), repository_root, home_directory) == [
        f"{manifest_path}: cannot read: No such file or directory"
    ]


def test_main_returns_zero_for_clean_manifests(
    repository_root: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Verify clean manifests exit 0 and print nothing."""
    monkeypatch.chdir(repository_root)
    write_manifest(repository_root, "pyproject.toml", "[tool.uv.sources]\npragma-api = { workspace = true }\n")

    assert main(["pyproject.toml"]) == 0
    assert capsys.readouterr().out == ""


def test_main_uses_working_directory_as_root(
    repository_root: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Verify a member path leaving the working directory fails even when it stays inside a parent directory."""
    member = repository_root / "packages" / "member"
    monkeypatch.chdir(member)
    write_manifest(member, "pyproject.toml", '[tool.uv.sources]\nshared = { path = "../shared" }\n')

    assert main(["pyproject.toml"]) == 1
    assert 'pyproject.toml: tool.uv.sources.shared.path = "../shared"' in capsys.readouterr().out


def test_main_expands_home_in_package_json(
    repository_root: Path, home_directory: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Verify ``~/`` in a ``package.json`` spec expands to the user's home directory."""
    monkeypatch.chdir(repository_root)
    monkeypatch.setenv("HOME", str(repository_root / "packages"))
    write_manifest(repository_root, "package.json", '{"dependencies": {"shared": "link:~/shared"}}')

    assert main(["package.json"]) == 0

    monkeypatch.setenv("HOME", str(home_directory))

    assert main(["package.json"]) == 1
    assert f'package.json: dependencies.shared = "link:~/shared" {OUTSIDE}' in capsys.readouterr().out


def test_main_reports_every_manifest_with_footer(
    repository_root: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Verify unreadable and unparsable manifests do not hide violations after them, and the footer prints."""
    monkeypatch.chdir(repository_root)
    write_manifest(repository_root, "package.json", '{"dependencies": ')
    write_manifest(
        repository_root / "packages" / "member", "pnpm-workspace.yaml", "overrides:\n  sdk: link:../../../pragma-sdk\n"
    )

    assert main(["missing/pyproject.toml", "package.json", "packages/member/pnpm-workspace.yaml"]) == 1
    output = capsys.readouterr().out
    assert "missing/pyproject.toml: cannot read: " in output
    assert "package.json: cannot parse: " in output
    assert 'packages/member/pnpm-workspace.yaml: overrides.sdk = "link:../../../pragma-sdk"' in output
    assert "Dependency source check failed" in output
    assert "docs/patterns/dependency-resolution.md" in output
