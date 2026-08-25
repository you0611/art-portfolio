import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");

const rootAssets = [
  "activities.html",
  "admin.html",
  "gallery.html",
  "index.html",
  "splash.html",
  "works.html",
  "admin.js",
  "app.js",
  "common.js",
  "work-detail.js",
  "splash.js",
  "styles.css",
  "robots.txt",
  "sitemap.xml",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const relativePath of rootAssets) {
  await cp(resolve(root, relativePath), resolve(output, relativePath));
}

for (const directory of ["assets", "works"]) {
  await cp(resolve(root, directory), resolve(output, directory), { recursive: true });
}

const built = await readdir(output);
console.log(`Built ${built.length} top-level static entries in dist.`);
