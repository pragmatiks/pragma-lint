"""Pytest configuration for pragma-lint."""

from __future__ import annotations

import sys
from pathlib import Path


PACKAGE_SOURCE = Path(__file__).parents[1] / "src"
sys.path.insert(0, str(PACKAGE_SOURCE))
