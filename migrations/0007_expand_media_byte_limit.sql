PRAGMA foreign_keys = ON;

CREATE TABLE media_assets_next (
  id TEXT PRIMARY KEY,
  artwork_id TEXT NOT NULL REFERENCES artworks(id),
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 104857600),
  width INTEGER NOT NULL CHECK (width BETWEEN 64 AND 12000),
  height INTEGER NOT NULL CHECK (height BETWEEN 64 AND 12000),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO media_assets_next (
  id, artwork_id, object_key, original_filename, mime_type,
  byte_size, width, height, sha256, status, created_by, created_at
)
SELECT
  id, artwork_id, object_key, original_filename, mime_type,
  byte_size, width, height, sha256, status, created_by, created_at
FROM media_assets;

DROP TABLE media_assets;
ALTER TABLE media_assets_next RENAME TO media_assets;

CREATE INDEX media_assets_artwork_idx
  ON media_assets (artwork_id, status, created_at DESC);
