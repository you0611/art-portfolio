PRAGMA foreign_keys = ON;

ALTER TABLE artworks ADD COLUMN primary_media_id TEXT;

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  artwork_id TEXT NOT NULL REFERENCES artworks(id),
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
  width INTEGER NOT NULL CHECK (width BETWEEN 64 AND 12000),
  height INTEGER NOT NULL CHECK (height BETWEEN 64 AND 12000),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX media_assets_artwork_idx
  ON media_assets (artwork_id, status, created_at DESC);

CREATE TABLE artwork_media_revisions (
  id TEXT PRIMARY KEY,
  artwork_id TEXT NOT NULL REFERENCES artworks(id),
  version INTEGER NOT NULL CHECK (version >= 1),
  previous_media_id TEXT,
  previous_image_url TEXT NOT NULL,
  replacement_media_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX artwork_media_revisions_artwork_idx
  ON artwork_media_revisions (artwork_id, version DESC, created_at DESC);
