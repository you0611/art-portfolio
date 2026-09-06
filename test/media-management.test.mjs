import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { onRequest as onAdminMedia } from "../functions/api/admin/artworks/[id]/media.js";
import { onRequest as onAdminMediaRestore } from "../functions/api/admin/artworks/[id]/media/restore.js";
import { onRequest as onPublicMedia } from "../functions/api/media/[id].js";
import { onRequest as onPublicArtworks } from "../functions/api/artworks/index.js";

const migrationSql = ["0001_commerce_foundation.sql", "0006_stage5_media.sql", "0007_expand_media_byte_limit.sql"]
  .map((file) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"))
  .join("\n");

test("catalog metadata accepts full-resolution lossless files while admin uploads remain capped", () => {
  const db = makeD1();
  db.database.prepare(`
    INSERT INTO media_assets
      (id, artwork_id, object_key, original_filename, mime_type, byte_size,
       width, height, sha256, status, created_by)
    VALUES
      ('media-catalog-large', 'guiquilaixi', 'artworks/guiquilaixi/media-catalog-large.webp',
       'catalog.webp', 'image/webp', 31029608, 5680, 5676,
       '0000000000000000000000000000000000000000000000000000000000000000',
       'active', 'catalog-refresh')
  `).run();
  assert.equal(db.database.prepare("SELECT byte_size FROM media_assets WHERE id = 'media-catalog-large'").get().byte_size, 31029608);
  assert.match(readFileSync(new URL("../functions/_lib/media.js", import.meta.url), "utf8"), /MAX_MEDIA_BYTES = 10 \* 1024 \* 1024/);
});

class D1PreparedShim {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) { return new D1PreparedShim(this.database, this.sql, values); }
  first(column) {
    const row = this.database.prepare(this.sql).get(...this.values);
    return column ? row?.[column] : row;
  }
  all() { return { success: true, results: this.database.prepare(this.sql).all(...this.values) }; }
  run() {
    const statement = this.database.prepare(this.sql);
    const results = /\bRETURNING\b/i.test(this.sql) ? statement.all(...this.values) : [];
    if (!/\bRETURNING\b/i.test(this.sql)) statement.run(...this.values);
    const changes = Number(this.database.prepare("SELECT changes() AS changes").get().changes);
    return { success: true, meta: { changes: 0 }, results };
  }
}

function makeD1({ failAudit = false } = {}) {
  const database = new DatabaseSync(":memory:");
  database.exec(migrationSql);
  return {
    prepare(sql) { return new D1PreparedShim(database, sql); },
    async batch(statements) {
      database.exec("BEGIN");
      try {
        const results = statements.map((statement) => {
          if (failAudit && /admin_audit_log/.test(statement.sql)) throw new Error("simulated audit failure");
          return statement.run();
        });
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    database,
  };
}

function makeBucket() {
  const objects = new Map();
  const deleted = [];
  return {
    objects,
    deleted,
    async put(key, body, options) {
      objects.set(key, { body: body.slice(0), options });
    },
    async get(key) {
      const object = objects.get(key);
      return object ? { body: object.body, httpEtag: '"fixture-etag"' } : null;
    },
    async head(key) {
      return objects.has(key) ? { httpEtag: '"fixture-etag"' } : null;
    },
    async delete(key) {
      deleted.push(key);
      objects.delete(key);
    },
  };
}

function pngFixture(width = 800, height = 600) {
  const bytes = new Uint8Array(29);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([8, 2, 0, 0, 0], 24);
  return bytes;
}

function uploadRequest({ version = 1, bytes = pngFixture(), type = "image/png", name = "江南 新图.png" } = {}) {
  const form = new FormData();
  form.append("version", String(version));
  form.append("file", new Blob([bytes], { type }), name);
  return new Request("https://preview.example.test/api/admin/artworks/guiquilaixi/media", {
    method: "POST",
    body: form,
  });
}

function adminContext(request, db, bucket, id = "guiquilaixi", env = {}) {
  return {
    request,
    params: { id },
    env: { DB: db, ...(bucket ? { MEDIA: bucket } : {}), ...env },
    data: { admin: { email: "admin@example.test" } },
  };
}

test("valid media is verified, stored under a generated key, linked atomically, and served privately", async () => {
  const db = makeD1();
  const bucket = makeBucket();
  const uploadResponse = await onAdminMedia(adminContext(uploadRequest(), db, bucket));
  assert.equal(uploadResponse.status, 201);
  assert.equal(uploadResponse.headers.get("cache-control"), "no-store");
  const uploaded = (await uploadResponse.json()).artwork;
  assert.match(uploaded.mediaId, /^media-[0-9a-f-]{36}$/);
  assert.equal(uploaded.image, `/api/media/${uploaded.mediaId}`);
  assert.equal(uploaded.mediaFilename, "江南 新图.png");
  assert.equal(uploaded.mediaWidth, 800);
  assert.equal(uploaded.mediaHeight, 600);
  assert.equal(uploaded.version, 2);
  assert.equal(uploaded.mediaCanRestore, true);

  const record = db.database.prepare("SELECT * FROM media_assets").get();
  assert.match(record.object_key, new RegExp(`^artworks/guiquilaixi/${uploaded.mediaId}\\.png$`));
  assert.equal(record.byte_size, 29);
  assert.equal(record.status, "active");
  assert.match(record.sha256, /^[0-9a-f]{64}$/);
  assert.equal(bucket.objects.size, 1);
  assert.equal(bucket.objects.get(record.object_key).options.httpMetadata.contentType, "image/png");
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM artwork_media_revisions").get().count, 1);
  assert.equal(db.database.prepare("SELECT action FROM admin_audit_log").get().action, "replace_artwork_media");

  const listResponse = await onPublicArtworks({
    request: new Request("https://preview.example.test/api/artworks"),
    env: { DB: db },
  });
  const listed = (await listResponse.json()).artworks.find((item) => item.id === "guiquilaixi");
  assert.equal(listed.image, uploaded.image);

  const mediaResponse = await onPublicMedia({
    request: new Request(`https://preview.example.test${uploaded.image}`),
    params: { id: uploaded.mediaId },
    env: { DB: db, MEDIA: bucket },
  });
  assert.equal(mediaResponse.status, 200);
  assert.equal(mediaResponse.headers.get("content-type"), "image/png");
  assert.match(mediaResponse.headers.get("cache-control"), /immutable/);
  assert.equal((await mediaResponse.arrayBuffer()).byteLength, 29);
});

test("restore returns to the retained static image without deleting uploaded objects", async () => {
  const db = makeD1();
  const bucket = makeBucket();
  const uploadResponse = await onAdminMedia(adminContext(uploadRequest(), db, bucket));
  const uploaded = (await uploadResponse.json()).artwork;
  const restoreRequest = new Request(
    "https://preview.example.test/api/admin/artworks/guiquilaixi/media/restore",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: uploaded.version }),
    },
  );
  const restoreResponse = await onAdminMediaRestore(adminContext(restoreRequest, db, bucket));
  assert.equal(restoreResponse.status, 200);
  const restored = (await restoreResponse.json()).artwork;
  assert.equal(restored.image, "/assets/guiquilaixi.jpg");
  assert.equal(restored.mediaId, null);
  assert.equal(restored.version, 3);
  assert.equal(restored.mediaCanRestore, false);
  assert.equal(bucket.objects.size, 1);
  assert.equal(bucket.deleted.length, 0);
  assert.equal(db.database.prepare("SELECT status FROM media_assets").get().status, "archived");
  assert.deepEqual(
    db.database.prepare("SELECT action FROM admin_audit_log ORDER BY created_at, rowid").all().map((row) => row.action),
    ["replace_artwork_media", "restore_artwork_media"],
  );
});

test("invalid files, stale versions, and absent storage fail closed", async () => {
  const db = makeD1();
  const bucket = makeBucket();
  const invalid = await onAdminMedia(adminContext(uploadRequest({ bytes: new Uint8Array([1, 2, 3]), type: "image/png" }), db, bucket));
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).error.code, "MEDIA_SIGNATURE_MISMATCH");
  assert.equal(bucket.objects.size, 0);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM media_assets").get().count, 0);

  const stale = await onAdminMedia(adminContext(uploadRequest({ version: 2 }), db, bucket));
  assert.equal(stale.status, 409);
  assert.equal(bucket.objects.size, 0);

  const unavailable = await onAdminMedia(adminContext(uploadRequest(), db, null));
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, "MEDIA_STORAGE_NOT_CONFIGURED");
});

test("preview quota rejects uploads before writing an R2 object", async () => {
  const db = makeD1();
  const bucket = makeBucket();
  const response = await onAdminMedia(adminContext(
    uploadRequest(),
    db,
    bucket,
    "guiquilaixi",
    { MEDIA_MAX_TOTAL_BYTES: "28", MEDIA_MAX_OBJECTS: "200" },
  ));
  assert.equal(response.status, 507);
  assert.equal((await response.json()).error.code, "MEDIA_STORAGE_LIMIT_REACHED");
  assert.equal(bucket.objects.size, 0);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM media_assets").get().count, 0);
});

test("a failed database transaction removes only the uncommitted generated object", async () => {
  const db = makeD1({ failAudit: true });
  const bucket = makeBucket();
  const response = await onAdminMedia(adminContext(uploadRequest(), db, bucket));
  assert.equal(response.status, 503);
  assert.equal(bucket.objects.size, 0);
  assert.equal(bucket.deleted.length, 1);
  assert.match(bucket.deleted[0], /^artworks\/guiquilaixi\/media-[0-9a-f-]{36}\.png$/);
  assert.equal(db.database.prepare("SELECT version, primary_media_id FROM artworks WHERE id = 'guiquilaixi'").get().version, 1);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM media_assets").get().count, 0);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM artwork_media_revisions").get().count, 0);
});

test("restore refuses to activate a previous uploaded image whose object is missing", async () => {
  const db = makeD1();
  const bucket = makeBucket();
  const firstResponse = await onAdminMedia(adminContext(uploadRequest(), db, bucket));
  const first = (await firstResponse.json()).artwork;
  const secondResponse = await onAdminMedia(adminContext(uploadRequest({ version: first.version, name: "second.png" }), db, bucket));
  const second = (await secondResponse.json()).artwork;
  const firstKey = db.database.prepare("SELECT object_key FROM media_assets WHERE id = ?").get(first.mediaId).object_key;
  bucket.objects.delete(firstKey);

  const restoreRequest = new Request(
    "https://preview.example.test/api/admin/artworks/guiquilaixi/media/restore",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: second.version }),
    },
  );
  const response = await onAdminMediaRestore(adminContext(restoreRequest, db, bucket));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "MEDIA_OBJECT_MISSING");
  const persisted = db.database.prepare("SELECT primary_media_id, version FROM artworks WHERE id = 'guiquilaixi'").get();
  assert.deepEqual({ ...persisted }, { primary_media_id: second.mediaId, version: 3 });
});
