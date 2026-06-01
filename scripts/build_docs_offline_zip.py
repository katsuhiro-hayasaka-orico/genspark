#!/usr/bin/env python3
"""Build MkDocs offline site and package it as a ZIP archive.

The ZIP archive contains the contents of site/ at its root, so index.html is
available immediately after extraction. The script uses only the Python standard
library and invokes MkDocs via ``python -m mkdocs``.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SITE_DIR = ROOT / "site"
DIST_DIR = ROOT / "dist"
DEFAULT_ZIP = DIST_DIR / "budget-csv-viewer-docs-offline.zip"
OFFLINE_CONFIG = ROOT / "mkdocs.offline.yml"


def run_mkdocs_build(clean: bool = True) -> None:
    if clean and SITE_DIR.exists():
        shutil.rmtree(SITE_DIR)

    command = [
        sys.executable,
        "-m",
        "mkdocs",
        "build",
        "--strict",
        "--config-file",
        str(OFFLINE_CONFIG),
    ]
    subprocess.run(command, cwd=ROOT, check=True)


def zip_site(output_path: Path) -> None:
    if not (SITE_DIR / "index.html").is_file():
        raise FileNotFoundError(f"{SITE_DIR / 'index.html'} was not generated")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    with ZipFile(output_path, "w", ZIP_DEFLATED) as archive:
        for path in sorted(SITE_DIR.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(SITE_DIR).as_posix())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build offline MkDocs ZIP")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_ZIP,
        help="Output ZIP path (default: dist/budget-csv-viewer-docs-offline.zip)",
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Do not remove site/ before building",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output if args.output.is_absolute() else ROOT / args.output
    run_mkdocs_build(clean=not args.no_clean)
    zip_site(output)
    print(f"Created {output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
