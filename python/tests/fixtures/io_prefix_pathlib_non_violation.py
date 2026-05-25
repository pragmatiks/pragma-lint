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


def save_pid_cleanup(pid_path: Path) -> None:
    pid_path.unlink()


def write_state_directory_init(state_directory: Path) -> None:
    state_directory.mkdir(parents=True, exist_ok=True)


def read_marker_file(marker_path: Path) -> str:
    return marker_path.read_text()


def query_marker_present(marker_path: Path) -> bool:
    return marker_path.exists()


def load_log_files(log_directory: Path) -> list[Path]:
    return list(log_directory.glob("*.log"))


def save_empty_directory_pruned(directory_path: Path) -> None:
    directory_path.rmdir()


async def read_async_state_file(state_path: Path) -> str:
    return state_path.read_text()
