// Pure session-token crypto — NO next/headers or next/navigation imports, so it
// is safe to use from Edge middleware as well as Node server code.

import type { Role } from "./users";

export const SESSION_COOKIE = "sp_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  sub: string; // app_users.id
  email: string;
  name: string | null;
  role: Role;
  exp: number; // unix seconds
}

const enc = new TextEncoder();

function b64urlBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64urlStr = (s: string) => b64urlBytes(enc.encode(s));
const strFromB64url = (s: string) => new TextDecoder().decode(bytesFromB64url(s));

const buf = (b: Uint8Array): BufferSource => b as BufferSource;

async function hmacKey(): Promise<CryptoKey | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return crypto.subtle.importKey("raw", buf(enc.encode(secret)), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** Sign a session token for a user (called at login). */
export async function signSession(user: Omit<SessionUser, "exp">): Promise<string | null> {
  const key = await hmacKey();
  if (!key) return null;
  const payload: SessionUser = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const body = b64urlStr(JSON.stringify(payload));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf(enc.encode(body))));
  return `${body}.${b64urlBytes(sig)}`;
}

/** Verify a token's signature + expiry → the session, or null. Edge-safe. */
export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const key = await hmacKey();
  if (!key) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", key, buf(bytesFromB64url(sig)), buf(enc.encode(body)));
  if (!ok) return null;
  try {
    const p = JSON.parse(strFromB64url(body)) as SessionUser;
    if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}
