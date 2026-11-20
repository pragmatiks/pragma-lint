import pytest


def test_named_like_double(monkeypatched_value: str, mock_server_url: str, mockery: str) -> None:
    assert monkeypatched_value
    assert mock_server_url
    assert mockery


@pytest.mark.usefixtures("tmp_path")
def test_real_fixture(request: pytest.FixtureRequest) -> None:
    assert request.getfixturevalue("tmp_path")
    assert "monkeypatch mocker"
