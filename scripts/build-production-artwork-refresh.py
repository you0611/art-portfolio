"""Build a reviewable Production D1 sync and R2 upload manifest.

This script only writes local artifacts. It never contacts Cloudflare.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


MIME_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def sql(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def media_id_from_route(route: str) -> str:
    prefix = "/api/media/"
    if not route.startswith(prefix):
        raise ValueError(f"Unsupported media route: {route}")
    return route[len(prefix):]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--media-map", required=True, type=Path)
    parser.add_argument("--baseline-catalog", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))["artworks"]
    media_map = json.loads(args.media_map.read_text(encoding="utf-8"))
    baseline = json.loads(args.baseline_catalog.read_text(encoding="utf-8"))["artworks"]
    baseline_ids = {item["id"] for item in baseline}
    target_ids = {item["id"] for item in catalog}
    removed_ids = sorted(baseline_ids - target_ids)

    manifest = []
    for artwork in catalog:
        media_id = media_id_from_route(artwork["image"])
        media = media_map[media_id]
        extension = MIME_EXTENSIONS[media["mimeType"]]
        object_key = f"artworks/{artwork['id']}/{media_id}.{extension}"
        manifest.append({
            "artworkId": artwork["id"],
            "mediaId": media_id,
            "objectKey": object_key,
            "path": media["path"],
            "mimeType": media["mimeType"],
            "byteSize": media["byteSize"],
            "width": media["width"],
            "height": media["height"],
            "sha256": media["sha256"],
            "originalFilename": f"{artwork['id']}.{extension}",
        })

    manifest_by_artwork = {item["artworkId"]: item for item in manifest}
    lines = ["PRAGMA foreign_keys = ON;", "BEGIN TRANSACTION;", ""]
    if removed_ids:
        ids = ", ".join(sql(item) for item in removed_ids)
        lines += [
            "UPDATE artworks",
            "SET content_status = 'archived', primary_media_id = NULL,",
            "    version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            f"WHERE id IN ({ids});",
            "",
        ]

    for artwork in catalog:
        sale_status = "not_for_sale" if artwork["saleStatus"] == "unconfirmed" else artwork["saleStatus"]
        values = [
            artwork["id"], artwork["titleZh"], artwork["titleEn"], artwork["category"],
            artwork["medium"], artwork["dimensions"], int(artwork["year"]),
            "/assets/artwork-placeholder.jpg", artwork["descriptionZh"], artwork["descriptionEn"],
            artwork["detailPathZh"], artwork["detailPathEn"], "published", sale_status,
            int(artwork["displayOrder"]),
        ]
        lines += [
            "INSERT INTO artworks (",
            "  id, title_zh, title_en, category, medium, dimensions, year, image_url,",
            "  description_zh, description_en, detail_path_zh, detail_path_en,",
            "  content_status, sale_status, display_order",
            ") VALUES (" + ", ".join(sql(value) for value in values) + ")",
            "ON CONFLICT(id) DO UPDATE SET",
            "  title_zh = excluded.title_zh, title_en = excluded.title_en, category = excluded.category,",
            "  medium = excluded.medium, dimensions = excluded.dimensions, year = excluded.year,",
            "  description_zh = excluded.description_zh, description_en = excluded.description_en,",
            "  detail_path_zh = excluded.detail_path_zh, detail_path_en = excluded.detail_path_en,",
            "  content_status = excluded.content_status, sale_status = excluded.sale_status,",
            "  display_order = excluded.display_order, version = artworks.version + 1,",
            "  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');",
            "",
        ]

    for artwork in catalog:
        media = manifest_by_artwork[artwork["id"]]
        media_values = [
            media["mediaId"], media["artworkId"], media["objectKey"], media["originalFilename"],
            media["mimeType"], media["byteSize"], media["width"], media["height"],
            media["sha256"], "active", "catalog-refresh-20260906",
        ]
        lines += [
            "INSERT INTO media_assets (",
            "  id, artwork_id, object_key, original_filename, mime_type, byte_size,",
            "  width, height, sha256, status, created_by",
            ") VALUES (" + ", ".join(sql(value) for value in media_values) + ")",
            "ON CONFLICT(id) DO UPDATE SET",
            "  artwork_id = excluded.artwork_id, object_key = excluded.object_key,",
            "  original_filename = excluded.original_filename, mime_type = excluded.mime_type,",
            "  byte_size = excluded.byte_size, width = excluded.width, height = excluded.height,",
            "  sha256 = excluded.sha256, status = 'active';",
            "",
        ]
        if artwork["id"] in baseline_ids:
            revision_hash = hashlib.sha256(f"{artwork['id']}:{media['mediaId']}".encode()).hexdigest()[:24]
            lines += [
                "INSERT OR IGNORE INTO artwork_media_revisions (",
                "  id, artwork_id, version, previous_media_id, previous_image_url,",
                "  replacement_media_id, admin_email, request_id",
                ") SELECT",
                f"  {sql('media-revision-refresh-' + revision_hash)}, id, version, primary_media_id, image_url,",
                f"  {sql(media['mediaId'])}, 'catalog-refresh@local', 'catalog-refresh-20260906'",
                "FROM artworks",
                f"WHERE id = {sql(artwork['id'])} AND primary_media_id IS NOT {sql(media['mediaId'])};",
                "",
            ]
        lines += [
            "UPDATE artworks",
            f"SET primary_media_id = {sql(media['mediaId'])}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            f"WHERE id = {sql(artwork['id'])};",
            "",
        ]

    target_media_ids = ", ".join(sql(item["mediaId"]) for item in manifest)
    lines += [
        f"UPDATE media_assets SET status = 'archived' WHERE id NOT IN ({target_media_ids});",
        "INSERT OR IGNORE INTO admin_audit_log (id, admin_email, action, entity_type, entity_id, request_id, details_json)",
        "VALUES ('audit-catalog-refresh-20260906', 'catalog-refresh@local', 'replace_public_catalog',",
        "        'catalog', 'public', 'catalog-refresh-20260906',",
        f"        {sql(json.dumps({'published': len(catalog), 'archived': len(removed_ids), 'media': len(manifest)}, ensure_ascii=False))});",
        "",
        "COMMIT;",
        "",
    ]

    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "production-media-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (args.output / "production-sync.sql").write_text("\n".join(lines), encoding="utf-8")
    (args.output / "production-cleanup-old-media.sql").write_text(
        "DELETE FROM media_assets WHERE status = 'archived';\n", encoding="utf-8"
    )
    print(json.dumps({
        "artworks": len(catalog),
        "media": len(manifest),
        "removedExisting": len(removed_ids),
        "maxMediaBytes": max(item["byteSize"] for item in manifest),
        "output": str(args.output.resolve()),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
