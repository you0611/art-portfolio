"""Exercise the generated Production catalog SQL against an isolated D1 export."""

from __future__ import annotations

import argparse
import sqlite3
import tempfile
from pathlib import Path


def scalar(connection: sqlite3.Connection, query: str) -> int:
    return int(connection.execute(query).fetchone()[0])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--export", required=True, type=Path)
    parser.add_argument("--migration", required=True, type=Path)
    parser.add_argument("--sync", required=True, type=Path)
    parser.add_argument("--cleanup", required=True, type=Path)
    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="yx-production-refresh-") as temporary:
        database = Path(temporary) / "production-refresh.sqlite3"
        connection = sqlite3.connect(database)
        try:
            connection.executescript(args.export.read_text(encoding="utf-8"))
            original_orders = scalar(connection, "SELECT COUNT(*) FROM orders")
            connection.executescript(args.migration.read_text(encoding="utf-8"))
            connection.executescript(args.sync.read_text(encoding="utf-8"))

            assert scalar(connection, "SELECT COUNT(*) FROM artworks WHERE content_status = 'published'") == 178
            assert scalar(connection, "SELECT COUNT(*) FROM artworks WHERE content_status = 'archived'") == 35
            assert scalar(connection, "SELECT COUNT(*) FROM artworks WHERE content_status = 'published' AND primary_media_id IS NOT NULL") == 178
            assert scalar(connection, "SELECT COUNT(*) FROM media_assets WHERE status = 'active'") == 178
            assert scalar(connection, "SELECT COUNT(*) FROM media_assets WHERE status = 'archived'") == 77
            assert scalar(connection, "SELECT COUNT(*) FROM orders") == original_orders
            assert scalar(connection, "SELECT COUNT(*) FROM pragma_foreign_key_check") == 0
            assert scalar(connection, "SELECT MAX(byte_size) FROM media_assets") > 10 * 1024 * 1024

            connection.executescript(args.cleanup.read_text(encoding="utf-8"))
            assert scalar(connection, "SELECT COUNT(*) FROM media_assets") == 178
            assert scalar(connection, "SELECT COUNT(*) FROM pragma_foreign_key_check") == 0
        finally:
            connection.close()

    print(
        "Verified isolated Production refresh: 178 published artworks, "
        "35 archived records, 178 active media rows, preserved orders, clean foreign keys."
    )


if __name__ == "__main__":
    main()
