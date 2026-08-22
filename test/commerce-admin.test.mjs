import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { onRequest as onAdminMiddleware } from "../functions/api/admin/_middleware.js";
import { onRequest as onArtworkList } from "../functions/api/admin/artworks/index.js";
import { onRequest as onArtworkById } from "../functions/api/admin/artworks/[id].js";

const migrationSql = readFileSync(
  new URL("../migrations/0001_commerce_foundation.sql", import.meta.url),
  "utf8",
);

class D1PreparedShim {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1PreparedShim(this.database, this.sql, values);
  }

  first(column) {
    const row = this.database.prepare(this.sql).get(...this.values);
    return column ? row?.[column] : row;
  }

  all() {
    return { success: true, results: this.database.prepare(this.sql).all(...this.values) };
  }

  run() {
    const statement = this.database.prepare(this.sql);
    const results = /\bRETURNING\b/i.test(this.sql) ? statement.all(...this.values) : [];
    if (!results.length && !/\bRETURNING\b/i.test(this.sql)) statement.run(...this.values);
    const changes = Number(this.database.prepare("SELECT changes() AS changes").get().changes);
    return { success: true, meta: { changes }, results };
  }
}

function makeD1(failAudit = false) {
  const database = new DatabaseSync(":memory:");
  database.exec(migrationSql);
  return {
    prepare(sql) {
      return new D1PreparedShim(database, sql);
    },
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

function contextFor(request, db, id = "guiquilaixi") {
  return {
    request,
    params: { id },
    env: { DB: db },
    data: { admin: { email: "admin@example.test" } },
  };
}

function patchRequest(body, headers = { "content-type": "application/json" }) {
  return new Request("https://preview.example.test/api/admin/artworks/guiquilaixi", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

test("admin artwork GET endpoints return complete no-store data", async () => {
  const db = makeD1();
  const listResponse = await onArtworkList(
    contextFor(new Request("https://preview.example.test/api/admin/artworks"), db),
  );
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.headers.get("cache-control"), "no-store");
  const list = await listResponse.json();
  assert.equal(list.artworks.length, 17);
  assert.equal(list.artworks[0].negotiationEnabled, true);
  assert.equal(list.artworks[0].priceMinor, null);

  const detailResponse = await onArtworkById(
    contextFor(new Request("https://preview.example.test/api/admin/artworks/guiquilaixi"), db),
  );
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.headers.get("cache-control"), "no-store");
  const detail = await detailResponse.json();
  assert.equal(detail.artwork.id, "guiquilaixi");
  assert.equal(detail.artwork.version, 1);
});

test("PATCH uses optimistic locking and writes one atomic audit record", async () => {
  const db = makeD1();
  const response = await onArtworkById(
    contextFor(
      patchRequest({ version: 1, titleZh: "SQL'; DROP TABLE artworks; --" }),
      db,
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  const body = await response.json();
  assert.equal(body.artwork.titleZh, "SQL'; DROP TABLE artworks; --");
  assert.equal(body.artwork.version, 2);

  const audit = db.database
    .prepare("SELECT admin_email, action, entity_type, entity_id, request_id, details_json FROM admin_audit_log")
    .all();
  assert.equal(audit.length, 1);
  assert.deepEqual(
    {
      admin_email: audit[0].admin_email,
      action: audit[0].action,
      entity_type: audit[0].entity_type,
      entity_id: audit[0].entity_id,
    },
    {
      admin_email: "admin@example.test",
      action: "update_artwork",
      entity_type: "artwork",
      entity_id: "guiquilaixi",
    },
  );
  assert.deepEqual(JSON.parse(audit[0].details_json), {
    changedFields: ["titleZh"],
    versionFrom: 1,
    versionTo: 2,
  });
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM artworks").get().count, 17);

  const conflictResponse = await onArtworkById(
    contextFor(patchRequest({ version: 1, titleZh: "stale write" }), db),
  );
  assert.equal(conflictResponse.status, 409);
  assert.equal(conflictResponse.headers.get("cache-control"), "no-store");
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM admin_audit_log").get().count,
    1,
  );
});

test("invalid artwork patches are rejected without a success audit", async () => {
  const cases = [
    [{ version: 1, unknownField: "nope" }, 400],
    [{ version: 1, saleStatus: "held" }, 422],
    [{ version: 1, year: 1899 }, 422],
    [{ version: 1, priceMinor: -1 }, 422],
    [{ version: 1, image: "https://attacker.example/image.jpg" }, 422],
    [{ version: 1, descriptionZh: null }, 422],
  ];
  for (const [body, expectedStatus] of cases) {
    const db = makeD1();
    const response = await onArtworkById(contextFor(patchRequest(body), db));
    assert.equal(response.status, expectedStatus);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM admin_audit_log").get().count, 0);
  }

  const db = makeD1();
  const wrongContentType = await onArtworkById(
    contextFor(patchRequest({ version: 1, titleZh: "nope" }, { "content-type": "text/plain" }), db),
  );
  assert.equal(wrongContentType.status, 415);
  assert.equal(wrongContentType.headers.get("cache-control"), "no-store");
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM admin_audit_log").get().count, 0);

  const missing = await onArtworkById(
    contextFor(patchRequest({ version: 1, titleZh: "nope" }), db, "missing-artwork"),
  );
  assert.equal(missing.status, 404);
});

test("a failed audit statement rolls back the artwork update", async () => {
  const db = makeD1(true);
  const response = await onArtworkById(
    contextFor(patchRequest({ version: 1, titleZh: "should roll back" }), db),
  );
  assert.equal(response.status, 503);
  const artwork = db.database
    .prepare("SELECT title_zh, version FROM artworks WHERE id = 'guiquilaixi'")
    .get();
  assert.deepEqual({ ...artwork }, { title_zh: "归去来兮", version: 1 });
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM admin_audit_log").get().count, 0);
});

test("admin middleware fails closed and every error response is uncached", async () => {
  const response = await onAdminMiddleware({
    request: new Request("https://preview.example.test/api/admin/session"),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("legacy front-end password flow and real-account-shaped email are absent", () => {
  const source = [
    "common.js",
    "app.js",
    "admin.js",
    "admin.html",
    "gallery.html",
  ]
    .map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"))
    .join("\n");
  assert.doesNotMatch(source, /ADMIN_PASSWORD|sessionStorage|adminPassword|you19790214/);
  assert.doesNotMatch(source, /@gmail\.com/i);
});
