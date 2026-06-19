import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchProfile, publicOrigin } from "@/lib/auth/microsoft";
import { findUser, touchLogin } from "@/lib/auth/users";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";

const secure = process.env.NODE_ENV === "production";

// Microsoft redirects back here with a code. Validate state, exchange the code,
// read the profile, enforce the invite list, then set the session cookie.
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request, request.nextUrl.origin);
  const params = request.nextUrl.searchParams;
  const fail = (err: string) => NextResponse.redirect(new URL(`/login?error=${err}`, origin));

  if (params.get("error")) return fail("auth");

  const code = params.get("code");
  const state = params.get("state");
  const savedState = request.cookies.get("sp_oauth_state")?.value;
  const verifier = request.cookies.get("sp_oauth_verifier")?.value;
  if (!code || !state || !verifier || state !== savedState) return fail("state");

  const accessToken = await exchangeCode(origin, code, verifier);
  if (!accessToken) return fail("auth");

  const profile = await fetchProfile(accessToken);
  if (!profile) return fail("auth");

  // Invite-only: the email must already be on the list.
  const user = await findUser(profile.email);
  if (!user) return fail("not-invited");

  await touchLogin(user.id, profile.name);
  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name ?? profile.name,
    role: user.role,
  });
  if (!token) return fail("config");

  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  // Clear the transient OAuth cookies.
  res.cookies.set("sp_oauth_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("sp_oauth_verifier", "", { path: "/", maxAge: 0 });
  return res;
}
