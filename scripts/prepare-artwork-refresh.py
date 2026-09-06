#!/usr/bin/env python3
"""Build an isolated, reviewable artwork catalog from a source image folder.

The script never writes to Cloudflare, D1, R2, or the source folder. JPEG and
PNG files are served byte-for-byte from the source. TIFF and HEIC inputs are
decoded once to full-resolution lossless browser formats for local review.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import re
import subprocess
import sys
import uuid
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageOps


SUPPORTED_DIRECT = {".jpg", ".jpeg", ".png", ".webp"}
LOSSLESS_CONVERT = {".heic", ".tif", ".tiff"}
DIMENSION_RE = re.compile(r"(?i)(?<!\d)(\d{2,3})\s*[x×]\s*(\d{2,3})(?:\s*cm)?")
COMPACT_DIMENSION_RE = re.compile(r"(?<!\d)(4040|5050|15075|150120|150390)(?!\d)")
YEAR_RE = re.compile(r"^(20\d{2})(?:年)?")
COPY_SUFFIX_RE = re.compile(r"\s*[（(](\d+)[）)]\s*$")
ROMANISH = str.maketrans({"（": "(", "）": ")", "—": "-", "－": "-", "。": ""})


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ffmpeg_convert(source: Path, target: Path, codec: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-frames:v", "1"]
    if codec == "png":
        command += ["-compression_level", "9"]
    else:
        command += ["-c:v", "libwebp", "-lossless", "1", "-compression_level", "6"]
    command.append(str(target))
    subprocess.run(command, check=True)


def prepare_browser_file(source: Path, converted_dir: Path) -> tuple[Path, str, bool]:
    suffix = source.suffix.lower()
    if suffix in SUPPORTED_DIRECT:
        mime = mimetypes.guess_type(source.name)[0] or "application/octet-stream"
        return source, mime, False
    if suffix not in LOSSLESS_CONVERT:
        raise ValueError(f"Unsupported image type: {source.name}")
    digest = sha256_file(source)[:20]
    extension = ".png" if suffix in {".tif", ".tiff"} else ".webp"
    target = converted_dir / f"{digest}{extension}"
    if not target.exists():
        ffmpeg_convert(source, target, "png" if extension == ".png" else "webp")
    return target, "image/png" if extension == ".png" else "image/webp", True


def image_features(path: Path) -> dict:
    with Image.open(path) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        width, height = image.size
        small = image.resize((17, 16), Image.Resampling.LANCZOS)
        pixels = list(small.getdata())
        gray = [round((r * 299 + g * 587 + b * 114) / 1000) for r, g, b in pixels]
        dhash = 0
        for y in range(16):
            offset = y * 17
            for x in range(16):
                dhash = (dhash << 1) | (gray[offset + x] > gray[offset + x + 1])
        average = sum(gray) / len(gray)
        ahash = 0
        for value in gray:
            ahash = (ahash << 1) | (value > average)
        normalized = hashlib.sha256(image.tobytes()).hexdigest()
        channel_means = tuple(round(sum(pixel[index] for pixel in pixels) / len(pixels)) for index in range(3))
        return {
            "width": width,
            "height": height,
            "dhash": dhash,
            "ahash": ahash,
            "pixelDigest": normalized,
            "channelMeans": channel_means,
        }


def dimensions_from_compact(token: str) -> tuple[int, int]:
    known = {
        "4040": (40, 40),
        "5050": (50, 50),
        "15075": (150, 75),
        "150120": (150, 120),
        "150390": (150, 390),
    }
    return known[token]


def normalize_title(value: str) -> str:
    value = value.translate(ROMANISH).lower()
    value = re.sub(r"\bno\.?\s*", "", value)
    value = re.sub(r"[\s\-_·,.，。:：'\"“”‘’《》()]+", "", value)
    return value


def parse_source_name(path: Path) -> dict:
    stem = path.stem.strip()
    year_match = YEAR_RE.match(stem)
    year = int(year_match.group(1)) if year_match else None
    remainder = stem[year_match.end():].strip() if year_match else stem

    dimension_match = DIMENSION_RE.search(remainder)
    compact_match = COMPACT_DIMENSION_RE.search(remainder) if not dimension_match else None
    if dimension_match:
        width_cm, height_cm = int(dimension_match.group(1)), int(dimension_match.group(2))
        dimension_span = dimension_match.span()
    elif compact_match:
        width_cm, height_cm = dimensions_from_compact(compact_match.group(1))
        dimension_span = compact_match.span()
    else:
        width_cm = height_cm = None
        dimension_span = None

    quoted = re.search(r"《([^》]+)》", remainder)
    if quoted:
        title = quoted.group(1).strip()
        tail = remainder[quoted.end(): dimension_span[0] if dimension_span and dimension_span[0] > quoted.end() else len(remainder)].strip()
        if tail and not re.match(r"^(?:cm|创作于|、|，|,|（?\d+）?)", tail, re.I):
            title += tail
    else:
        title = remainder
        if dimension_span:
            title = title[:dimension_span[0]] + title[dimension_span[1]:]
        title = re.split(r"(?:创作于|、布面|，布面|国展|省展|游祥龙|_20\d{6})", title, maxsplit=1)[0]

    title = re.sub(r"(?i)\bcm\b", "", title)
    title = re.sub(r"\s+", "", title).strip("-_、，,。")
    title = title.replace("(", "（").replace(")", "）")
    medium = "布面油画" if "布面油画" in stem else ""
    dimensions = f"{width_cm} × {height_cm} cm" if width_cm and height_cm else ""
    return {
        "titleZh": title or stem,
        "year": year,
        "dimensions": dimensions,
        "medium": medium,
        "sourceFilename": path.name,
    }


def quality_score(entry: dict) -> tuple:
    metadata = entry["metadata"]
    name = metadata["sourceFilename"]
    return (
        bool(re.search(r"《[^》]+》", name)),
        bool(metadata["dimensions"]),
        bool(metadata["medium"]),
        len(name),
    )


def visual_distance(left: dict, right: dict) -> int:
    if abs(left["width"] / left["height"] - right["width"] / right["height"]) > 0.08:
        return 10_000
    hash_distance = (left["dhash"] ^ right["dhash"]).bit_count() + (left["ahash"] ^ right["ahash"]).bit_count()
    color_distance = sum(abs(a - b) for a, b in zip(left["channelMeans"], right["channelMeans"])) // 12
    return hash_distance + color_distance


def deterministic_media_id(digest: str) -> str:
    value = uuid.UUID(digest[:32])
    return f"media-{value}"


def build_source_entries(source_dir: Path, output_dir: Path) -> tuple[list[dict], list[dict]]:
    converted_dir = output_dir / "converted-lossless"
    candidates = []
    for source in sorted(source_dir.iterdir(), key=lambda item: item.name.casefold()):
        if not source.is_file() or source.suffix.lower() not in SUPPORTED_DIRECT | LOSSLESS_CONVERT:
            continue
        browser_path, mime_type, converted = prepare_browser_file(source, converted_dir)
        features = image_features(browser_path)
        digest = sha256_file(source)
        object_digest = sha256_file(browser_path)
        metadata = parse_source_name(source)
        candidates.append({
            "sourcePath": str(source.resolve()),
            "browserPath": str(browser_path.resolve()),
            "mimeType": mime_type,
            "convertedLossless": converted,
            "sourceDigest": digest,
            "objectDigest": object_digest,
            "byteSize": browser_path.stat().st_size,
            "metadata": metadata,
            "features": features,
        })

    groups: dict[str, list[dict]] = defaultdict(list)
    for entry in candidates:
        groups[entry["features"]["pixelDigest"]].append(entry)

    unique = []
    duplicates = []
    for group in groups.values():
        group.sort(key=quality_score, reverse=True)
        winner = group[0]
        unique.append(winner)
        for duplicate in group[1:]:
            duplicates.append({
                "kept": winner["metadata"]["sourceFilename"],
                "skipped": duplicate["metadata"]["sourceFilename"],
                "reason": "decoded pixels are identical",
            })
    unique.sort(key=lambda item: item["metadata"]["sourceFilename"].casefold())
    return unique, duplicates


def load_baseline(catalog_path: Path, image_dir: Path) -> list[dict]:
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))["artworks"]
    for artwork in catalog:
        artwork["features"] = image_features(image_dir / f"{artwork['id']}.img")
    return catalog


def match_catalog(baseline: list[dict], sources: list[dict]) -> tuple[dict[int, tuple[int, str, int]], set[int]]:
    matches: dict[int, tuple[int, str, int]] = {}
    used_sources: set[int] = set()
    pairs = []
    for baseline_index, artwork in enumerate(baseline):
        for source_index, source in enumerate(sources):
            distance = visual_distance(artwork["features"], source["features"])
            if distance <= 34:
                pairs.append((distance, baseline_index, source_index))
    for distance, baseline_index, source_index in sorted(pairs):
        if baseline_index in matches or source_index in used_sources:
            continue
        matches[baseline_index] = (source_index, "visual", distance)
        used_sources.add(source_index)

    remaining_by_title: dict[str, list[int]] = defaultdict(list)
    for source_index, source in enumerate(sources):
        if source_index not in used_sources:
            remaining_by_title[normalize_title(source["metadata"]["titleZh"])].append(source_index)
    for baseline_index, artwork in enumerate(baseline):
        if baseline_index in matches:
            continue
        candidates = remaining_by_title.get(normalize_title(artwork.get("titleZh", "")), [])
        candidates = [index for index in candidates if index not in used_sources]
        same_year = [index for index in candidates if sources[index]["metadata"]["year"] == artwork.get("year")]
        chosen = same_year if len(same_year) == 1 else candidates
        if len(chosen) == 1:
            source_index = chosen[0]
            matches[baseline_index] = (source_index, "title", -1)
            used_sources.add(source_index)
    return matches, used_sources


def public_artwork(existing: dict, source: dict, display_order: int) -> dict:
    metadata = source["metadata"]
    same_title = normalize_title(existing.get("titleZh", "")) == normalize_title(metadata["titleZh"])
    media_id = deterministic_media_id(source["sourceDigest"])
    return {
        "id": existing["id"],
        "titleZh": metadata["titleZh"] or existing.get("titleZh", ""),
        "titleEn": existing.get("titleEn", "") if same_title else "",
        "category": existing.get("category", "") if same_title else "",
        "medium": metadata["medium"] or (existing.get("medium", "") if same_title else ""),
        "dimensions": metadata["dimensions"] or existing.get("dimensions", ""),
        "year": metadata["year"] or existing.get("year"),
        "image": f"/api/media/{media_id}",
        "descriptionZh": existing.get("descriptionZh", "") if same_title else "",
        "descriptionEn": existing.get("descriptionEn", "") if same_title else "",
        "detailPathZh": existing.get("detailPathZh") if same_title else None,
        "detailPathEn": existing.get("detailPathEn") if same_title else None,
        "saleStatus": existing.get("saleStatus", "unconfirmed"),
        "displayOrder": display_order,
    }


def new_public_artwork(source: dict, display_order: int) -> dict:
    metadata = source["metadata"]
    media_id = deterministic_media_id(source["sourceDigest"])
    return {
        "id": f"refresh-{metadata['year'] or 'unknown'}-{source['sourceDigest'][:12]}",
        "titleZh": metadata["titleZh"],
        "titleEn": "",
        "category": "",
        "medium": metadata["medium"],
        "dimensions": metadata["dimensions"],
        "year": metadata["year"],
        "image": f"/api/media/{media_id}",
        "descriptionZh": "",
        "descriptionEn": "",
        "detailPathZh": None,
        "detailPathEn": None,
        "saleStatus": "unconfirmed",
        "displayOrder": display_order,
    }


def write_report(output_dir: Path, baseline: list[dict], sources: list[dict], duplicates: list[dict], matches: dict, used_sources: set[int], catalog: list[dict]) -> None:
    lines = [
        "# 本地作品素材替换验收清单",
        "",
        f"- 线上基线作品：{len(baseline)} 件",
        f"- 新素材文件：{len(sources) + len(duplicates)} 张",
        f"- 去除像素完全重复后：{len(sources)} 张",
        f"- 已匹配并替换：{len(matches)} 件",
        f"- 原作品无新图、已从本地目录移除：{len(baseline) - len(matches)} 件",
        f"- 新增作品栏目：{len(sources) - len(used_sources)} 件",
        f"- 本地预览作品总数：{len(catalog)} 件",
        "",
        "## 完全重复且未重复导入",
        "",
    ]
    if duplicates:
        lines += [f"- 保留 `{item['kept']}`；跳过 `{item['skipped']}`。" for item in duplicates]
    else:
        lines.append("- 无。")
    lines += ["", "## 原作品无对应新图、已移除", ""]
    unmatched = [artwork for index, artwork in enumerate(baseline) if index not in matches]
    lines += [f"- `{item['id']}` — {item['titleZh']}" for item in unmatched] or ["- 无。"]
    lines += ["", "## 匹配详情", ""]
    for baseline_index, (source_index, method, distance) in sorted(matches.items()):
        artwork = baseline[baseline_index]
        filename = sources[source_index]["metadata"]["sourceFilename"]
        suffix = f"，指纹距离 {distance}" if distance >= 0 else ""
        lines.append(f"- `{artwork['id']}`：{artwork['titleZh']} ← `{filename}`（{method}{suffix}）")
    lines += ["", "## 无损转换", ""]
    converted = [entry for entry in sources if entry["convertedLossless"]]
    for entry in converted:
        features = entry["features"]
        lines.append(
            f"- `{entry['metadata']['sourceFilename']}` → {entry['mimeType']}，"
            f"{features['width']}×{features['height']} px，{entry['byteSize'] / 1024 / 1024:.2f} MiB。"
        )
    (output_dir / "review-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--baseline-catalog", required=True, type=Path)
    parser.add_argument("--baseline-images", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    sources, duplicates = build_source_entries(args.source.resolve(), args.output.resolve())
    baseline = load_baseline(args.baseline_catalog.resolve(), args.baseline_images.resolve())
    matches, used_sources = match_catalog(baseline, sources)

    catalog = []
    media = {}
    for index, existing in enumerate(baseline):
        if index not in matches:
            continue
        source = sources[matches[index][0]]
        catalog.append(public_artwork(existing, source, len(catalog) + 1))
    for source_index, source in enumerate(sources):
        if source_index not in used_sources:
            catalog.append(new_public_artwork(source, len(catalog) + 1))
    for source in sources:
        media_id = deterministic_media_id(source["sourceDigest"])
        media[media_id] = {
            "path": source["browserPath"],
            "mimeType": source["mimeType"],
            "originalFilename": source["metadata"]["sourceFilename"],
            "width": source["features"]["width"],
            "height": source["features"]["height"],
            "byteSize": source["byteSize"],
            "convertedLossless": source["convertedLossless"],
            "sha256": source["objectDigest"],
        }

    (args.output / "artworks.json").write_text(json.dumps({"artworks": catalog}, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.output / "media-map.json").write_text(json.dumps(media, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.output / "duplicate-files.json").write_text(json.dumps(duplicates, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(args.output, baseline, sources, duplicates, matches, used_sources, catalog)
    print(json.dumps({
        "baseline": len(baseline),
        "sourceFiles": len(sources) + len(duplicates),
        "uniqueImages": len(sources),
        "matched": len(matches),
        "removedExisting": len(baseline) - len(matches),
        "newArtworks": len(sources) - len(used_sources),
        "previewTotal": len(catalog),
        "output": str(args.output.resolve()),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"prepare-artwork-refresh failed: {error}", file=sys.stderr)
        raise
