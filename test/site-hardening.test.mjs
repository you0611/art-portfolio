import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("public metadata and crawler boundaries are explicit", () => {
  const index = read("index.html");
  const gallery = read("gallery.html");
  const works = read("works.html");
  const activities = read("activities.html");
  const admin = read("admin.html");
  const robots = read("robots.txt");
  const sitemap = read("sitemap.xml");

  for (const page of [index, gallery, works, activities]) {
    assert.match(page, /<meta property="og:title"/);
    assert.match(page, /<meta property="og:image"/);
    assert.match(page, /<link rel="canonical"/);
  }
  assert.match(admin, /<meta name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(robots, /Disallow: \/admin/);
  assert.doesNotMatch(sitemap, /admin(?:\.html)?/i);
  assert.doesNotMatch(read("scripts/build.mjs"), /"test\.html"/);
});

test("work pages keep valid quoted metadata and eager artwork loading", () => {
  for (const page of ["works/cai-lusheng.html", "works/jiangnan-trip.html", "works/ta-series-5.html"]) {
    const source = read(page);
    assert.match(source, /&quot;/);
    assert.match(source, /loading="eager" decoding="async"/);
  }
});

test("standalone work pages retain static image fallbacks and load server-managed primary images", () => {
  const pages = readdirSync(new URL("../works", import.meta.url)).filter((name) => name.endsWith(".html"));
  assert.equal(pages.length, 14);
  for (const page of pages) {
    const source = readFileSync(new URL(`../works/${page}`, import.meta.url), "utf8");
    assert.match(source, /<img src="\.\.\/assets\/[^"]+\.jpg"/);
    assert.match(source, /<script src="\.\.\/work-detail\.js\?v=20260825-media"><\/script>/);
  }
  const script = readFileSync(new URL("../work-detail.js", import.meta.url), "utf8");
  assert.match(script, /fetch\("\/api\/artworks"/);
  assert.match(script, /image\.src = fallback/);
  assert.doesNotMatch(script, /innerHTML/);

  const app = read("app.js");
  const common = read("common.js");
  assert.match(app, /loadPublicArtworks\(\)/);
  assert.match(common, /fetch\("\/api\/artworks"/);
  assert.match(common, /image:\s*artwork\.image|\bimage,/);
  assert.match(common, /cache:\s*"no-store"/);
});

test("inquiry flow explains the next step and disables empty inventory", () => {
  const app = read("app.js");
  const common = read("common.js");
  const gallery = read("gallery.html");

  assert.match(app, /noAvailableWorks/);
  assert.match(app, /select\.disabled = !availableWorks\.length/);
  assert.match(app, /inquiryRetry\.signature !== signature/);
  assert.match(app, /"idempotency-key": inquiryRetry\.key/);
  assert.match(app, /AbortController/);
  assert.match(common, /inquiryTimeout:/);
  assert.match(common, /contactProcess:/);
  assert.match(gallery, /class="contact-process"/);
  assert.match(gallery, /autocomplete="name"/);
  assert.match(gallery, /role="status"/);
});

test("admin errors distinguish network, timeout, and email outbox failure", () => {
  const admin = read("admin.js");
  const common = read("common.js");

  assert.match(admin, /REQUEST_TIMEOUT_MS = 15000/);
  assert.match(admin, /NETWORK_UNAVAILABLE/);
  assert.match(admin, /emailOutboxError/);
  assert.match(common, /adminNetworkUnavailable:/);
  assert.match(common, /adminRequestTimeout:/);
  assert.match(common, /emailOutboxLoadFailed:/);
});

test("admin exposes a read-only media integrity check with recoverable states", () => {
  const admin = read("admin.js");
  const adminPage = read("admin.html");
  const common = read("common.js");

  assert.match(adminPage, /id="checkMediaIntegrity"/);
  assert.match(adminPage, /aria-live="polite"/);
  assert.match(admin, /requestJson\("\/api\/admin\/media-integrity"\)/);
  assert.match(admin, /mediaIntegrityReport\.healthy/);
  assert.match(common, /mediaIntegrityHealthy:/);
  assert.match(common, /mediaIntegrityFailed:/);
});

test("mobile controls and hero keep a compact touch-safe layout", () => {
  const styles = read("styles.css");

  assert.match(styles, /\.header-inquiry[\s\S]*?min-height: 44px/);
  assert.match(styles, /\.tab,[\s\S]*?\.icon-button[\s\S]*?min-height: 44px/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.hero-stage[\s\S]*?min-height: 60svh/);
  assert.match(styles, /\.admin-tabs[\s\S]*?position: sticky/);
});

test("the release check includes an isolated D1 export and restore rehearsal", () => {
  const packageJson = JSON.parse(read("package.json"));
  const recovery = read("scripts/verify-d1-recovery.mjs");

  assert.match(packageJson.scripts.check, /db:recovery:fixture/);
  assert.match(recovery, /mkdtemp/);
  assert.match(recovery, /d1", "export/);
  assert.match(recovery, /d1", "execute/);
  assert.match(recovery, /one_active_hold_per_artwork_idx/);
  assert.match(recovery, /fixture@example\.invalid/);
});

test("standalone work pages carry their work into the inquiry form", () => {
  const workIds = [
    "cai-lusheng",
    "flower-2025",
    "grass-2024",
    "jiangnan-2024",
    "jiangnan-series-6",
    "jiangnan-trip",
    "ta-series-5",
  ];

  for (const workId of workIds) {
    assert.match(read(`works/${workId}.html`), new RegExp(`gallery\\.html\\?work=${workId}#contact`));
    assert.match(read(`works/${workId}-en.html`), new RegExp(`gallery\\.html\\?work=${workId}#contact`));
  }
});

test("order tools keep cancelled inquiries viewable and expose only valid next stages", () => {
  const admin = read("admin.js");
  const adminPage = read("admin.html");

  assert.match(admin, /statusForm\.hidden = false/);
  assert.match(admin, /submitted: \["negotiating", "cancelled"\]/);
  assert.match(admin, /negotiating: \["awaiting_payment", "cancelled"\]/);
  assert.match(admin, /awaiting_payment: \["cancelled"\]/);
  assert.match(admin, /cancelled: \[\]/);
  assert.match(admin, /cancelledOrderReadonly/);
  assert.match(adminPage, /id="orderFollowUpFilter"/);
  assert.match(adminPage, /id="followUpForm"/);
  assert.match(admin, /notificationEventList/);
  assert.match(admin, /followUpStatus/);
});

test("held inventory uses visitor-facing unavailable copy", () => {
  const common = read("common.js");
  assert.match(common, /held: "暂不可咨询"/);
  assert.match(common, /held: "Temporarily unavailable"/);
});
