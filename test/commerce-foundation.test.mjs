import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { AccessConfigurationError, normalizeAccessConfig } from "../functions/_lib/access.js";

const migrationSql = readFileSync(
  new URL("../migrations/0001_commerce_foundation.sql", import.meta.url),
  "utf8",
);

function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(migrationSql);
  return database;
}

test("initial migration contains the 17 verified artworks", () => {
  const database = migratedDatabase();
  const totals = database
    .prepare("SELECT COUNT(*) AS total, SUM(sale_status = 'available') AS available, SUM(sale_status = 'sold') AS sold FROM artworks")
    .get();

  assert.deepEqual({ ...totals }, { total: 17, available: 12, sold: 5 });
  const nonNegotiable = database
    .prepare("SELECT COUNT(*) AS count FROM artworks WHERE negotiation_enabled <> 1 OR price_minor IS NOT NULL")
    .get();
  assert.equal(nonNegotiable.count, 0);
});

test("database constraints reject invalid artwork states", () => {
  const database = migratedDatabase();
  assert.throws(() => {
    database
      .prepare("UPDATE artworks SET sale_status = ? WHERE id = ?")
      .run("unknown", "guiquilaixi");
  }, /constraint/i);
});

test("only one active inventory hold can exist for an original artwork", () => {
  const database = migratedDatabase();
  const createOrder = database.prepare(
    "INSERT INTO orders (id, public_reference, customer_name, customer_email) VALUES (?, ?, ?, ?)",
  );
  createOrder.run("order-1", "YX-0001", "Buyer One", "one@example.test");
  createOrder.run("order-2", "YX-0002", "Buyer Two", "two@example.test");

  const createHold = database.prepare(
    "INSERT INTO inventory_holds (id, artwork_id, order_id, expires_at) VALUES (?, ?, ?, ?)",
  );
  createHold.run("hold-1", "guiquilaixi", "order-1", "2099-01-01T00:00:00Z");
  assert.throws(
    () => createHold.run("hold-2", "guiquilaixi", "order-2", "2099-01-01T00:00:00Z"),
    /unique/i,
  );

  database.prepare("UPDATE inventory_holds SET status = 'released' WHERE id = 'hold-1'").run();
  assert.doesNotThrow(() =>
    createHold.run("hold-2", "guiquilaixi", "order-2", "2099-01-01T00:00:00Z"),
  );
});

test("admin access configuration fails closed and accepts one exact email", () => {
  assert.throws(() => normalizeAccessConfig({}), AccessConfigurationError);
  assert.throws(
    () =>
      normalizeAccessConfig({
        ACCESS_TEAM_DOMAIN: "https://example.com",
        ACCESS_AUD: "audience",
        ADMIN_EMAIL: "owner@example.test",
      }),
    AccessConfigurationError,
  );

  assert.deepEqual(
    normalizeAccessConfig({
      ACCESS_TEAM_DOMAIN: "https://studio.cloudflareaccess.com",
      ACCESS_AUD: "audience",
      ADMIN_EMAIL: " Owner@Example.Test ",
    }),
    {
      teamDomain: "https://studio.cloudflareaccess.com",
      audience: "audience",
      adminEmail: "owner@example.test",
    },
  );
});
