#!/usr/bin/env python3
"""Build the public user manual site from a filtered temporary docs tree.

The public manual must not use ``docs/`` directly because that directory also
contains internal specifications. This script copies only whitelisted manual
Markdown files and the required CSS assets into .build/user-manual-docs before
running MkDocs.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE_MANUALS = ROOT / "docs" / "manuals"
SOURCE_ASSETS = ROOT / "docs" / "assets"
BUILD_DOCS = ROOT / ".build" / "user-manual-docs"
SITE_DIR = ROOT / "site-user-manual"
DIST_DIR = ROOT / "dist"
DEFAULT_ZIP = DIST_DIR / "user-manual-offline.zip"
WEB_CONFIG = ROOT / "mkdocs.user.yml"
OFFLINE_CONFIG = ROOT / "mkdocs.user.offline.yml"

MANUAL_FILES = [
    "index.md",
    "getting-started.md",
    "user-guide.md",
    "import-export.md",
    "faq.md",
    "troubleshooting.md",
]

FORBIDDEN_ARCHIVE_PARTS = {
    "01_overview.md",
    "02_screen-list.md",
    "03_data-import.md",
    "04_api-spec.md",
    "05_data-dictionary.md",
    "06_calculation-logic.md",
    "07_screen-specs",
    "08_ui-ux.md",
    "09_error-handling.md",
    "99_source-map.md",
    "adr",
    "admin-guide.md",
}

FORBIDDEN_TEXT_MARKERS = [
    "API仕様",
    "データ項目辞書",
    "内部設計",
    "Architecture Decision Record",
    "docs/07_screen-specs",
    "server.js",
]


def clean_path(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)


def prepare_docs() -> None:
    clean_path(BUILD_DOCS)
    BUILD_DOCS.mkdir(parents=True, exist_ok=True)

    for name in MANUAL_FILES:
        src = SOURCE_MANUALS / name
        if not src.is_file():
            raise FileNotFoundError(f"Required user manual source is missing: {src}")
        shutil.copy2(src, BUILD_DOCS / name)

    css_src = SOURCE_ASSETS / "css" / "custom.css"
    css_dst = BUILD_DOCS / "assets" / "css" / "custom.css"
    if not css_src.is_file():
        raise FileNotFoundError(f"Required stylesheet is missing: {css_src}")
    css_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(css_src, css_dst)

    if not (BUILD_DOCS / "index.md").is_file():
        raise FileNotFoundError("Prepared user manual docs must include index.md")


def run_mkdocs(config: Path, clean_site: bool = True) -> None:
    if clean_site:
        clean_path(SITE_DIR)
    command = [
        sys.executable,
        "-m",
        "mkdocs",
        "build",
        "--strict",
        "--config-file",
        str(config),
    ]
    subprocess.run(command, cwd=ROOT, check=True)


def validate_no_internal_sources_in_site() -> None:
    if not SITE_DIR.is_dir():
        raise FileNotFoundError(f"{SITE_DIR} was not generated")

    for path in SITE_DIR.rglob("*"):
        rel = path.relative_to(SITE_DIR).as_posix()
        lower_rel = rel.lower()
        if any(part.lower() in lower_rel for part in FORBIDDEN_ARCHIVE_PARTS):
            raise RuntimeError(f"Internal documentation path was included in user manual site: {rel}")
        if path.is_file() and path.suffix.lower() in {".html", ".json", ".js", ".txt"}:
            text = path.read_text(encoding="utf-8", errors="ignore")
            for marker in FORBIDDEN_TEXT_MARKERS:
                if marker in text:
                    raise RuntimeError(f"Internal documentation marker {marker!r} found in {rel}")


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

    with ZipFile(output_path) as archive:
        names = archive.namelist()
        if "index.html" not in names:
            raise RuntimeError("Offline ZIP must contain index.html at the archive root")
        for name in names:
            lower_name = name.lower()
            if any(part.lower() in lower_name for part in FORBIDDEN_ARCHIVE_PARTS):
                raise RuntimeError(f"Internal documentation file was included in ZIP: {name}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build public user manual site/ZIP")
    parser.add_argument(
        "--web-only",
        action="store_true",
        help="Prepare the filtered docs tree and build the web site with mkdocs.user.yml without creating a ZIP",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_ZIP,
        help="Output ZIP path (default: dist/user-manual-offline.zip)",
    )
    parser.add_argument(
        "--no-clean-site",
        action="store_true",
        help="Do not remove site-user-manual/ before building",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output if args.output.is_absolute() else ROOT / args.output
    prepare_docs()
    if args.web_only:
        run_mkdocs(WEB_CONFIG, clean_site=not args.no_clean_site)
        validate_no_internal_sources_in_site()
        print("Built user manual web site")
        return 0

    run_mkdocs(OFFLINE_CONFIG, clean_site=not args.no_clean_site)
    validate_no_internal_sources_in_site()
    zip_site(output)
    print(f"Created {output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
