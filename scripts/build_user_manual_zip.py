#!/usr/bin/env python3
"""Build the public user manual site from a filtered temporary docs tree.

The public manual must not use ``docs/`` directly because that directory also
contains internal specifications. This script copies only whitelisted manual
Markdown files and the required CSS assets into .build/user-manual-docs before
running MkDocs.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE_MANUALS = ROOT / "docs" / "manuals"
SOURCE_ASSETS = ROOT / "docs" / "assets"
SOURCE_MANUAL_ASSETS = SOURCE_MANUALS / "assets"
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


UM_ID_RE = re.compile(r"\bUM-[A-Za-z0-9][A-Za-z0-9_-]*")
SCREENSHOT_TODO_ID_RE = re.compile(r"\bID\s*:\s*(UM-[A-Za-z0-9][A-Za-z0-9_-]*)")
PLANNED_FILE_RE = re.compile(r"予定ファイル\s*[:：]\s*([^\s)）>,]+)")
MARKDOWN_IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)")
MANUAL_IMAGE_PREFIXES = ("assets/images/", "./assets/images/")


def format_source_location(path: Path, line_number: int) -> str:
    return f"{path.relative_to(ROOT).as_posix()}:{line_number}"


def clean_manual_path_text(path_text: str) -> str:
    return path_text.strip().strip('"\'<>').rstrip("。、")


def is_manual_image_path(path_text: str) -> bool:
    normalized = clean_manual_path_text(path_text)
    return any(normalized.startswith(prefix) for prefix in MANUAL_IMAGE_PREFIXES)


def planned_asset_path(path_text: str) -> Path:
    normalized = clean_manual_path_text(path_text)
    if normalized.startswith("./"):
        normalized = normalized[2:]
    normalized = normalized.split("#", 1)[0].split("?", 1)[0]
    return SOURCE_MANUALS / normalized


def collect_screenshot_todo_block(lines: list[str], start_index: int) -> str:
    block_lines = [lines[start_index]]
    for line in lines[start_index + 1 :]:
        stripped = line.strip()
        if not stripped:
            break
        if stripped.startswith(">"):
            block_lines.append(line)
            continue
        break
    return "\n".join(block_lines)


def validate_manual_screenshot_assets(require_images: bool = False) -> None:
    """Validate screenshot TODO IDs and planned/manual image paths.

    The default mode allows image files that have not been captured yet so the
    user manual can be built while screenshot TODOs are still open. Pass
    ``require_images=True`` for pre-release checks that must fail when a planned
    or referenced manual screenshot image is missing.
    """

    errors: list[str] = []
    screenshot_ids: dict[str, list[str]] = {}

    for markdown_path in sorted(SOURCE_MANUALS.glob("*.md")):
        lines = markdown_path.read_text(encoding="utf-8").splitlines()
        for index, line in enumerate(lines):
            line_number = index + 1
            if "TODO" in line and ("画面キャプチャ" in line or "スクリーンショット" in line):
                id_match = SCREENSHOT_TODO_ID_RE.search(line)
                if id_match:
                    screenshot_id = id_match.group(1)
                    location = format_source_location(markdown_path, line_number)
                    screenshot_ids.setdefault(screenshot_id, []).append(location)
                    block = collect_screenshot_todo_block(lines, index)
                    planned_match = PLANNED_FILE_RE.search(block)
                    if not planned_match:
                        errors.append(f"{location}: screenshot TODO {screenshot_id} is missing 予定ファイル")
                        continue

                    planned_file = planned_match.group(1)
                    if not is_manual_image_path(planned_file):
                        errors.append(
                            f"{location}: planned file for {screenshot_id} must be under assets/images/: {planned_file}"
                        )
                    if screenshot_id not in planned_file:
                        errors.append(
                            f"{location}: planned file name/path must contain {screenshot_id}: {planned_file}"
                        )
                    if require_images and not planned_asset_path(planned_file).is_file():
                        errors.append(f"{location}: planned screenshot image does not exist: {planned_file}")

            for image_match in MARKDOWN_IMAGE_RE.finditer(line):
                image_path = image_match.group(1)
                if not is_manual_image_path(image_path):
                    continue
                location = format_source_location(markdown_path, line_number)
                if not UM_ID_RE.search(image_path):
                    errors.append(f"{location}: manual screenshot image path must contain an UM-* ID: {image_path}")
                if require_images and not planned_asset_path(image_path).is_file():
                    errors.append(f"{location}: referenced manual screenshot image does not exist: {image_path}")

    for screenshot_id, locations in sorted(screenshot_ids.items()):
        if len(locations) > 1:
            errors.append(f"screenshot TODO ID {screenshot_id} appears multiple times: {', '.join(locations)}")

    if errors:
        raise RuntimeError("Manual screenshot validation failed:\n- " + "\n- ".join(errors))


def clean_path(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)


def prepare_docs(require_manual_images: bool = False) -> None:
    validate_manual_screenshot_assets(require_images=require_manual_images)

    clean_path(BUILD_DOCS)
    BUILD_DOCS.mkdir(parents=True, exist_ok=True)

    for name in MANUAL_FILES:
        src = SOURCE_MANUALS / name
        if not src.is_file():
            raise FileNotFoundError(f"Required user manual source is missing: {src}")
        shutil.copy2(src, BUILD_DOCS / name)

    if SOURCE_MANUAL_ASSETS.is_dir():
        shutil.copytree(SOURCE_MANUAL_ASSETS, BUILD_DOCS / "assets", dirs_exist_ok=True)

    # Keep the shared MkDocs stylesheet available for mkdocs.user*.yml.
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
    parser.add_argument(
        "--require-manual-images",
        action="store_true",
        help="Fail when planned or referenced manual screenshot images under assets/images/ are missing",
    )
    parser.add_argument(
        "--check-screenshots-only",
        action="store_true",
        help="Validate manual screenshot TODOs/images without preparing docs, running MkDocs, or creating a ZIP",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output if args.output.is_absolute() else ROOT / args.output
    if args.check_screenshots_only:
        validate_manual_screenshot_assets(require_images=args.require_manual_images)
        print("Manual screenshot validation passed")
        return 0

    prepare_docs(require_manual_images=args.require_manual_images)
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
