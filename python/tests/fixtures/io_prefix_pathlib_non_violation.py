from pathlib import Path


def read_pid_file(pid_path: Path) -> int:
    return int(pid_path.read_text().strip())


def write_pid_file(pid_path: Path, pid_value: int) -> None:
    pid_path.write_text(str(pid_value))


def load_config(config_path: Path) -> bytes:
    return config_path.read_bytes()


def save_payload(payload_path: Path, payload: bytes) -> None:
    payload_path.write_bytes(payload)


def get_state_files(state_directory: Path) -> list[Path]:
    return [entry for entry in state_directory.iterdir() if entry.is_file()]


def delete_pid_file(pid_path: Path) -> None:
    pid_path.unlink()


def create_state_directory(state_directory: Path) -> None:
    state_directory.mkdir(parents=True, exist_ok=True)


def read_marker_file(marker_path: Path) -> str:
    if marker_path.exists():
        return marker_path.read_text()
    return ""


def find_log_files(log_directory: Path) -> list[Path]:
    return list(log_directory.glob("*.log"))


def remove_empty_directory(directory_path: Path) -> None:
    directory_path.rmdir()


async def aread_state_file(state_path: Path) -> str:
    return state_path.read_text()
