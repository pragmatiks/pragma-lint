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
