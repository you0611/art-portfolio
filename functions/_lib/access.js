import { createRemoteJWKSet, jwtVerify } from "jose";

const jwksByDomain = new Map();

export class AccessConfigurationError extends Error {}

export function normalizeAccessConfig(env) {
  const rawDomain = env.ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.ACCESS_AUD?.trim();
  const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();

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
