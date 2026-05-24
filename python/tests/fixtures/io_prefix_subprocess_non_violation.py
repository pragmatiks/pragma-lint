import shutil
import subprocess


def write_nats_config(target_path: str, source_path: str) -> None:
    shutil.copyfile(source_path, target_path)


def write_environment_file(command: list[str]) -> None:
    subprocess.run(command, check=True)


def fetch_remote_archive(url: str, destination: str) -> None:
    subprocess.check_call(["curl", "-fsSL", url, "-o", destination])
