import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const redirectUri = "http://127.0.0.1:8789/oauth/callback";
const scope = "https://www.googleapis.com/auth/gmail.send";
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function readLocalVars() {
  const file = `${projectRoot}.dev.vars`;
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

function value(name, localVars) {
  return String(process.env[name] || localVars[name] || "").trim();
}

function saveRefreshToken(token) {
  const file = `${projectRoot}.dev.vars`;
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const line = `GMAIL_REFRESH_TOKEN=${token}`;
  const updated = /^GMAIL_REFRESH_TOKEN=.*$/m.test(current)
    ? current.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, line)
    : `${current.trimEnd()}\n${line}\n`;
  writeFileSync(file, updated, "utf8");
}

function html(message) {
  return `<!doctype html><meta charset="utf-8"><title>Gmail authorization</title><p>${message}</p>`;
}

const localVars = readLocalVars();
const clientId = value("GMAIL_CLIENT_ID", localVars);
const clientSecret = value("GMAIL_CLIENT_SECRET", localVars);
if (!clientId || !clientSecret) {
  console.error("GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .dev.vars or the environment.");
  process.exit(1);
}

const state = randomUUID();
const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", redirectUri);
  if (requestUrl.pathname !== "/oauth/callback") {
    response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    response.end(html("Not found."));
    return;
  }

  if (requestUrl.searchParams.get("state") !== state) {
    response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
    response.end(html("Authorization state did not match. You can close this window."));
    server.close();
    return;
  }

  const error = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");
  if (error || !code) {
    response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
    response.end(html("Google authorization was cancelled or failed. You can close this window."));
    server.close();
    return;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenBody = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenBody.refresh_token) {
      throw new Error(`Token exchange failed (${tokenResponse.status}).`);
    }
    saveRefreshToken(tokenBody.refresh_token);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html("Authorization complete. You can close this window and return to the terminal."));
    console.log("\nGoogle authorization complete.");
    console.log("The Gmail refresh token was saved to the local .dev.vars file.");
  } catch (exchangeError) {
    response.writeHead(502, { "content-type": "text/html; charset=utf-8" });
    response.end(html("Token exchange failed. You can close this window and inspect the terminal."));
    console.error(exchangeError.message);
  } finally {
    server.close();
  }
});

server.listen(8789, "127.0.0.1", () => {
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope,
    state,
  });
  console.log("Open this URL in your browser and authorize the Gmail account:");
  console.log(authorizationUrl.toString());
  console.log(`Waiting for the OAuth callback at ${redirectUri} ...`);
});
