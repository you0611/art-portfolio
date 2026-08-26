import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = resolve(root, "node_modules", "wrangler", "bin", "wrangler.js");
const database = "yx-art-studio-commerce-preview";
const configPath = resolve(root, "wrangler.preview.jsonc");
const temporaryRoot = await mkdtemp(join(tmpdir(), "yx-preview-d1-backup-"));
const exportPath = join(temporaryRoot, "preview-export.sql");
const countSql = `
  SELECT
    (SELECT COUNT(*) FROM artworks) AS artworks,
    (SELECT COUNT(*) FROM orders) AS orders,
    (SELECT COUNT(*) FROM notification_events) AS events,
    (SELECT COUNT(*) FROM email_outbox) AS outbox,
    (SELECT COUNT(*) FROM site_profiles) AS profiles,
    (SELECT COUNT(*) FROM site_entries) AS content_entries,
    (SELECT COUNT(*) FROM media_assets) AS media_assets,
    (SELECT COUNT(*) FROM artwork_media_revisions) AS media_revisions,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'one_active_hold_per_artwork_idx') AS hold_index,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'notification_events_email_outbox') AS outbox_trigger;
`;

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

function queryResult(stdout) {
  const payload = JSON.parse(stdout);
  const result = Array.isArray(payload) ? payload[0] : payload;
  return result?.results?.[0] || result?.result?.[0];
}

function localConfig() {
  return JSON.stringify({
    name: "youxianglong-preview-recovery-check",
    compatibility_date: "2026-08-21",
    d1_databases: [{
      binding: "DB",
      database_name: database,
      database_id: "00000000-0000-0000-0000-000000000000",
    }],
  }, null, 2);
}

try {
  const remote = queryResult(runWrangler([
    "d1", "execute", database,
    "--remote", "--config", configPath,
    "--command", countSql, "--json",
  ]));

  runWrangler([
    "d1", "export", database,
    "--remote", "--config", configPath,
    "--output", exportPath, "--skip-confirmation",
  ]);

  await writeFile(join(temporaryRoot, "wrangler.jsonc"), localConfig(), "utf8");
  runWrangler([
    "d1", "execute", database,
    "--local", "--cwd", temporaryRoot,
    "--file", exportPath, "--yes",
  ]);
  const restored = queryResult(runWrangler([
    "d1", "execute", database,
    "--local", "--cwd", temporaryRoot,
    "--command", countSql, "--json",
  ]));

  assert.deepEqual(restored, remote);
  assert.equal(remote.hold_index, 1, "Restored database lost the inventory uniqueness index.");
  assert.equal(remote.outbox_trigger, 1, "Restored database lost the email outbox trigger.");
  const exported = await stat(exportPath);
  assert.ok(exported.size > 0, "Preview export was empty.");

  console.log(JSON.stringify({
    verified: true,
    exportBytes: exported.size,
    counts: remote,
    temporaryExportRemoved: true,
  }));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
