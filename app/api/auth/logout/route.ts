import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

function clear(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  return clear(request);
}
export async function POST(request: NextRequest) {
  return clear(request);
}
