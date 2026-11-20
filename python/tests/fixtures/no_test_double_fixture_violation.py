from typing import Any

import pytest


pytestmark = pytest.mark.usefixtures("monkeypatch")
pytestmark_list = [pytest.mark.usefixtures("session_mocker")]


def test_parameter(monkeypatch: Any) -> None:
    assert monkeypatch


def test_annotated(monkeypatch: pytest.MonkeyPatch) -> None:
    assert monkeypatch


async def test_async(mocker: Any) -> None:
    assert mocker


@pytest.fixture
def patched(class_mocker: Any, module_mocker: Any, package_mocker: Any) -> Any:
    return class_mocker, module_mocker, package_mocker


@pytest.mark.usefixtures("mocker")
def test_usefixtures() -> None:
    assert True


def test_dynamic(request: pytest.FixtureRequest) -> None:
    assert request.getfixturevalue("monkeypatch")
