import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const siteRoot = resolve(argument("site", "dist"));
const catalogPath = resolve(argument("catalog"));
const mediaMapPath = resolve(argument("media-map"));
const port = Number(argument("port", "4175"));
const catalog = readFileSync(catalogPath);
const mediaMap = JSON.parse(readFileSync(mediaMapPath, "utf8"));

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function sendFile(response, path, contentType, cacheControl = "no-store") {
  const size = statSync(path).size;
  response.writeHead(200, {
    "content-type": contentType,
    "content-length": size,
    "cache-control": cacheControl,
  });
  createReadStream(path).pipe(response);
}

createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
  if (url.pathname === "/api/artworks") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(catalog);
    return;
  }
  if (url.pathname.startsWith("/api/media/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/media/".length));
    const media = mediaMap[id];
    if (!media) {
      response.writeHead(404).end();
      return;
    }
    sendFile(response, media.path, media.mimeType, "public, max-age=31536000, immutable");
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end('{"error":{"code":"LOCAL_REVIEW_ONLY"}}');
    return;
  }

  const route = url.pathname === "/" ? "/gallery.html" : url.pathname;
  const relative = route.replace(/^\/+/, "");
  const candidate = resolve(siteRoot, relative);
  if (candidate !== siteRoot && !candidate.startsWith(`${siteRoot}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    sendFile(response, candidate, types[extname(candidate).toLowerCase()] || "application/octet-stream");
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Artwork refresh review: http://127.0.0.1:${port}/gallery.html`);
});
