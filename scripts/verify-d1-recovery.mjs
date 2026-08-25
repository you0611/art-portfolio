import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = resolve(root, "node_modules", "wrangler", "bin", "wrangler.js");
const database = "yx-art-studio-recovery-fixture";
const temporaryRoot = await mkdtemp(join(tmpdir(), "yx-art-recovery-"));
const sourceRoot = join(temporaryRoot, "source");
const restoredRoot = join(temporaryRoot, "restored");
const exportPath = join(temporaryRoot, "fixture-export.sql");

function runWrangler(args, { expectFailure = false } = {}) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (expectFailure) {
    assert.notEqual(result.status, 0, `Expected Wrangler to fail: ${args.join(" ")}`);
  } else if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

function config() {
  return JSON.stringify({
    name: "youxianglong-recovery-fixture",
    compatibility_date: "2026-08-21",
    d1_databases: [{
      binding: "DB",
      database_name: database,
      database_id: "00000000-0000-0000-0000-000000000000",
      migrations_dir: "migrations",
    }],
  }, null, 2);
}

function queryResult(stdout) {
  const payload = JSON.parse(stdout);
  const result = Array.isArray(payload) ? payload[0] : payload;
  return result?.results?.[0] || result?.result?.[0];
}

try {
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(restoredRoot, { recursive: true });
  await cp(resolve(root, "migrations"), join(sourceRoot, "migrations"), { recursive: true });
  await writeFile(join(sourceRoot, "wrangler.jsonc"), config(), "utf8");
  await writeFile(join(restoredRoot, "wrangler.jsonc"), config(), "utf8");

  runWrangler([
    "d1", "migrations", "apply", database,
    "--local", "--cwd", sourceRoot,
  ]);
  runWrangler([
    "d1", "execute", database,
    "--local", "--cwd", sourceRoot,
    "--command",
    "INSERT INTO orders (id, public_reference, customer_name, customer_email, customer_contact, preferred_language, idempotency_key) VALUES ('fixture-order', 'YX-FIXTURE', 'Fixture', 'fixture@example.invalid', 'fixture-only', 'zh', 'fixture-idempotency'); INSERT INTO order_items (id, order_id, artwork_id) VALUES ('fixture-item', 'fixture-order', 'guiquilaixi');",
  ]);
  runWrangler([
    "d1", "export", database,
    "--local", "--cwd", sourceRoot, "--output", exportPath, "--skip-confirmation",
  ]);
  runWrangler([
    "d1", "execute", database,
    "--local", "--cwd", restoredRoot,
    "--file", exportPath, "--yes",
  ]);

  const stdout = runWrangler([
    "d1", "execute", database,
    "--local", "--cwd", restoredRoot,
    "--command",
    "SELECT (SELECT COUNT(*) FROM artworks) AS artworks, (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM notification_events) AS events, (SELECT COUNT(*) FROM email_outbox) AS outbox, (SELECT COUNT(*) FROM site_profiles) AS profiles, (SELECT COUNT(*) FROM site_entries) AS content_entries, (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'one_active_hold_per_artwork_idx') AS hold_index, (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'notification_events_email_outbox') AS outbox_trigger;",
    "--json",
  ]);
  const result = queryResult(stdout);
  assert.deepEqual(result, {
    artworks: 17,
    orders: 1,
    events: 1,
    outbox: 1,
    profiles: 1,
    content_entries: 22,
    hold_index: 1,
    outbox_trigger: 1,
  });

  runWrangler([
    "d1", "execute", database,
    "--local", "--cwd", restoredRoot,
    "--command",
    "INSERT INTO orders (id, public_reference, customer_name, customer_email, customer_contact, preferred_language, idempotency_key) VALUES ('fixture-order-duplicate', 'YX-FIXTURE-2', 'Fixture', 'fixture@example.invalid', 'fixture-only', 'zh', 'fixture-idempotency');",
  ], { expectFailure: true });

  console.log("Verified isolated D1 export/restore: 17 artworks, 22 content entries, 1 profile, 1 fixture order, notification/outbox triggers, and idempotency constraint.");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
