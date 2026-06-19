import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/token";

// Auth is OFF until SESSION_SECRET is configured, so the app stays usable while
// Microsoft SSO is being set up. Once the secret is set, every page outside
// /login requires a valid session. (Next 16 renamed "middleware" → "proxy".)
export async function proxy(request: NextRequest) {
  if (!process.env.SESSION_SECRET) return NextResponse.next();

  const { pathname, origin } = request.nextUrl;
  const user = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return user ? NextResponse.redirect(new URL("/", origin)) : NextResponse.next();
  }
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  return NextResponse.next();
}

export const config = {
  // Run on everything except the auth API, Next internals, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)).*)"],
};
