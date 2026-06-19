// Microsoft Entra ID (Azure AD) OAuth 2.0 authorization-code flow with PKCE.
// Self-contained — no auth library. We trust the tokens because they're fetched
// server-to-server directly from Microsoft's token endpoint over TLS, then read
// the profile from Microsoft Graph.

const TENANT = process.env.AZURE_TENANT_ID || "common";
const BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;
const SCOPE = "openid profile email User.Read offline_access";

export function microsoftConfigured(): boolean {
  return !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
}

/** Redirect URI must match what's registered in Azure — derived from the request. */
export function redirectUri(origin: string): string {
  return `${origin}/api/auth/callback`;
}

/** Public origin behind a proxy (Render/Vercel set x-forwarded-*). Without this
    the request's own host is the internal one (e.g. localhost:10000). Locally
    there's no x-forwarded-host, so we keep the request's own origin (http). */
export function publicOrigin(req: Request, fallback: string): string {
  const host = req.headers.get("x-forwarded-host");
  if (!host) return fallback;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

const enc = new TextEncoder();
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE verifier (random) + matching S256 challenge. */
export async function makePkce(): Promise<{ verifier: string; challenge: string }> {
  const rand = new Uint8Array(48);
  crypto.getRandomValues(rand);
  const verifier = b64url(rand);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", enc.encode(verifier) as BufferSource),
  );
  return { verifier, challenge: b64url(digest) };
}

export function randomState(): string {
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  return b64url(rand);
}

export function authorizeUrl(origin: string, state: string, challenge: string): string {
  const p = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(origin),
    response_mode: "query",
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${BASE}/authorize?${p.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCode(
  origin: string,
  code: string,
  verifier: string,
): Promise<string | null> {
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    client_secret: process.env.AZURE_CLIENT_SECRET!,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(origin),
    code_verifier: verifier,
    scope: SCOPE,
  });
  const res = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as TokenResponse;
  return res.ok ? data.access_token ?? null : null;
}

export interface MsProfile {
  email: string;
  name: string | null;
}

/** Read the signed-in user's email + name from Microsoft Graph. */
export async function fetchProfile(accessToken: string): Promise<MsProfile | null> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const me = (await res.json()) as {
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };
  const email = me.mail || me.userPrincipalName;
  if (!email) return null;
  return { email, name: me.displayName ?? null };
}
