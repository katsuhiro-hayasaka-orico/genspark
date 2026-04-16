"""PyInstaller 用エントリーポイント.

EXE 化後に streamlit_app.py をローカルで起動するためのラッパー。
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def resolve_app_path() -> Path:
    if getattr(sys, "frozen", False):
        base = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
        return base / "streamlit_app.py"
    return Path(__file__).resolve().parent / "streamlit_app.py"


def main() -> None:
    app_path = resolve_app_path()
    if not app_path.exists():
        raise FileNotFoundError(f"streamlit_app.py が見つかりません: {app_path}")

    # ブラウザ自動起動を抑制し、localhost のみで起動
    os.environ.setdefault("STREAMLIT_BROWSER_GATHER_USAGE_STATS", "false")

    from streamlit.web import cli as stcli

    sys.argv = [
        "streamlit",
        "run",
        str(app_path),
        "--server.address",
        "127.0.0.1",
        "--server.headless",
        "true",
    ]
    raise SystemExit(stcli.main())


if __name__ == "__main__":
    main()
