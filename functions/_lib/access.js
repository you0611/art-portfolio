import { createRemoteJWKSet, jwtVerify } from "jose";

const jwksByDomain = new Map();

export class AccessConfigurationError extends Error {}

function isLoopbackRequest(request) {
  let hostname;
  try {
    hostname = new URL(request.url).hostname;
  } catch {
    return false;
  }

  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

export function verifyLocalAdminPreview(request, env) {
  if (String(env.LOCAL_ADMIN_PREVIEW || "").trim().toLowerCase() !== "true") return null;
  if (!isLoopbackRequest(request)) return null;

  const adminEmail = typeof env.ADMIN_EMAIL === "string" ? env.ADMIN_EMAIL.trim().toLowerCase() : "";
  if (!adminEmail) throw new AccessConfigurationError("ADMIN_EMAIL is required for local admin preview.");

  return { email: adminEmail, subject: "local-preview" };
}

export function normalizeAccessConfig(env) {
  const rawDomain = typeof env.ACCESS_TEAM_DOMAIN === "string" ? env.ACCESS_TEAM_DOMAIN.trim() : "";
  const audience = typeof env.ACCESS_AUD === "string" ? env.ACCESS_AUD.trim() : "";
  const adminEmail = typeof env.ADMIN_EMAIL === "string" ? env.ADMIN_EMAIL.trim().toLowerCase() : "";

  if (!rawDomain || !audience || !adminEmail) {
    throw new AccessConfigurationError("Cloudflare Access is not configured.");
  }

  let domain;
  try {
    domain = new URL(rawDomain);
  } catch {
    throw new AccessConfigurationError("ACCESS_TEAM_DOMAIN must be a valid URL.");
  }

  if (
    domain.protocol !== "https:" ||
    !domain.hostname.endsWith(".cloudflareaccess.com") ||
    domain.pathname !== "/" ||
    domain.search ||
    domain.hash
  ) {
    throw new AccessConfigurationError("ACCESS_TEAM_DOMAIN must be an HTTPS Cloudflare Access team domain.");
  }

  return {
    teamDomain: domain.origin,
    audience,
    adminEmail,
  };
}

function getJwks(teamDomain) {
  let jwks = jwksByDomain.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksByDomain.set(teamDomain, jwks);
  }
  return jwks;
}

export async function verifyAdminAccess(request, env) {
  const config = normalizeAccessConfig(env);
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) throw new Error("Missing Cloudflare Access assertion.");

  const { payload } = await jwtVerify(token, getJwks(config.teamDomain), {
    issuer: config.teamDomain,
    audience: config.audience,
  });

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || email !== config.adminEmail) {
    throw new Error("Authenticated identity is not the configured administrator.");
  }

  return { email, subject: payload.sub || null };
}
