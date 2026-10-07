from pathlib import Path


def read_pid_lines(pid_path: Path) -> list[str]:
    with open(pid_path) as pid_file:
        return pid_file.readlines()


def read_pid_text(pid_path: Path) -> str:
    return open(pid_path).read()
