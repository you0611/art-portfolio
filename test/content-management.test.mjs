import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { onRequest as onPublicContent } from "../functions/api/content/index.js";
import { onRequest as onAdminContent } from "../functions/api/admin/content/index.js";
import { onRequest as onProfile } from "../functions/api/admin/content/profile.js";
import { onRequest as onProfileRestore } from "../functions/api/admin/content/profile/restore.js";
import { onRequest as onEntryCreate } from "../functions/api/admin/content/entries/index.js";
import { onRequest as onEntry } from "../functions/api/admin/content/entries/[id].js";
import { onRequest as onEntryRestore } from "../functions/api/admin/content/entries/[id]/restore.js";

const migrationSql = ["0001_commerce_foundation.sql", "0005_stage5_content.sql"]
  .map((file) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"))
  .join("\n");

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
    if (!/\bRETURNING\b/i.test(this.sql)) statement.run(...this.values);
    const changes = Number(this.database.prepare("SELECT changes() AS changes").get().changes);
    return { success: true, meta: { changes: 0 }, results };
  }
}

function makeD1({ failAudit = false } = {}) {
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

function context(request, db, id) {
  return {
    request,
    params: id ? { id } : {},
    env: { DB: db },
    data: { admin: { email: "admin@example.test" } },
  };
}

function jsonRequest(path, method, body) {
  return new Request(`https://preview.example.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("content migration seeds only existing profile and 22 timeline records", async () => {
  const db = makeD1();
  const profile = db.database.prepare("SELECT artist_name_zh, version FROM site_profiles").get();
  assert.deepEqual({ ...profile }, { artist_name_zh: "游祥龙", version: 1 });
  const counts = db.database
    .prepare("SELECT kind, COUNT(*) AS count FROM site_entries GROUP BY kind ORDER BY kind")
    .all();
  assert.deepEqual(counts.map((row) => ({ ...row })), [{ kind: "timeline", count: 22 }]);

  const response = await onPublicContent(context(new Request("https://preview.example.test/api/content"), db));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /max-age=0/);
  const body = await response.json();
  assert.equal(body.profile.artistNameZh, "游祥龙");
  assert.equal(body.entries.length, 22);
  assert.ok(body.entries.every((entry) => entry.kind === "timeline"));
});

test("profile updates use a whitelist, optimistic locking, audit, and one-step restore", async () => {
  const db = makeD1();
  const invalid = await onProfile(context(jsonRequest("/api/admin/content/profile", "PATCH", {
    version: 1,
    unknown: "nope",
  }), db));
  assert.equal(invalid.status, 400);

  const updatedResponse = await onProfile(context(jsonRequest("/api/admin/content/profile", "PATCH", {
    version: 1,
    heroTextZh: "新的首页说明 ✨",
  }), db));
  assert.equal(updatedResponse.status, 200);
  assert.equal(updatedResponse.headers.get("cache-control"), "no-store");
  const updated = (await updatedResponse.json()).profile;
  assert.equal(updated.heroTextZh, "新的首页说明 ✨");
  assert.equal(updated.version, 2);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM site_content_revisions").get().count, 1);
  assert.equal(db.database.prepare("SELECT action FROM admin_audit_log").get().action, "update_site_profile");

  const stale = await onProfile(context(jsonRequest("/api/admin/content/profile", "PATCH", {
    version: 1,
    heroTextZh: "stale",
  }), db));
  assert.equal(stale.status, 409);

  const restoredResponse = await onProfileRestore(context(jsonRequest("/api/admin/content/profile/restore", "POST", {
    version: 2,
  }), db));
  assert.equal(restoredResponse.status, 200);
  const restored = (await restoredResponse.json()).profile;
  assert.equal(restored.heroTextZh, "在江南水色与人物叙事之间，记录时间、乡土与人的精神轮廓。");
  assert.equal(restored.version, 3);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM site_content_revisions").get().count, 2);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM admin_audit_log").get().count, 2);
});

test("content entries can be created, archived, restored, and are never deleted", async () => {
  const db = makeD1();
  const createResponse = await onEntryCreate(context(jsonRequest("/api/admin/content/entries", "POST", {
    kind: "activity",
    yearLabel: "2026-09-01",
    titleZh: "测试活动",
    titleEn: "Fixture Event",
    bodyZh: "仅用于本地测试。",
    bodyEn: "Local fixture only.",
    sourceUrl: "https://example.test/source",
    contentStatus: "draft",
    displayOrder: 100,
  }), db));
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).entry;
  assert.match(created.id, /^content-[0-9a-f-]{36}$/);

  const patchResponse = await onEntry(context(jsonRequest(`/api/admin/content/entries/${created.id}`, "PATCH", {
    version: 1,
    contentStatus: "archived",
  }), db, created.id));
  assert.equal(patchResponse.status, 200);
  const archived = (await patchResponse.json()).entry;
  assert.equal(archived.contentStatus, "archived");
  assert.equal(archived.version, 2);

  const restoreResponse = await onEntryRestore(context(jsonRequest(`/api/admin/content/entries/${created.id}/restore`, "POST", {
    version: 2,
  }), db, created.id));
  assert.equal(restoreResponse.status, 200);
  const restored = (await restoreResponse.json()).entry;
  assert.equal(restored.contentStatus, "draft");
  assert.equal(restored.version, 3);

  const insecureSource = await onEntry(context(jsonRequest(`/api/admin/content/entries/${created.id}`, "PATCH", {
    version: 3,
    sourceUrl: "http://example.test/source",
  }), db, created.id));
  assert.equal(insecureSource.status, 422);

  const adminResponse = await onAdminContent(context(new Request("https://preview.example.test/api/admin/content"), db));
  const adminBody = await adminResponse.json();
  assert.equal(adminBody.entries.find((entry) => entry.id === created.id).canRestore, true);
});

test("a failed audit rolls back profile content and its revision", async () => {
  const db = makeD1({ failAudit: true });
  const response = await onProfile(context(jsonRequest("/api/admin/content/profile", "PATCH", {
    version: 1,
    heroTextZh: "should roll back",
  }), db));
  assert.equal(response.status, 503);
  assert.equal(db.database.prepare("SELECT hero_text_zh FROM site_profiles").get().hero_text_zh,
    "在江南水色与人物叙事之间，记录时间、乡土与人的精神轮廓。");
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM site_content_revisions").get().count, 0);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM admin_audit_log").get().count, 0);
});
