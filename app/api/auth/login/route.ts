import { NextRequest, NextResponse } from "next/server";
import { microsoftConfigured, authorizeUrl, makePkce, randomState } from "@/lib/auth/microsoft";

const secure = process.env.NODE_ENV === "production";

// Kick off Microsoft sign-in: stash PKCE verifier + state in short-lived cookies,
// then redirect to Microsoft's authorize endpoint.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (!microsoftConfigured()) {
    return NextResponse.redirect(new URL("/login?error=config", origin));
  }
  const { verifier, challenge } = await makePkce();
  const state = randomState();
  const res = NextResponse.redirect(authorizeUrl(origin, state, challenge));
  const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("sp_oauth_state", state, opts);
  res.cookies.set("sp_oauth_verifier", verifier, opts);
  return res;
}
