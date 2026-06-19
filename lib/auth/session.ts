// Server-side session helpers (use next/headers + navigation). For the pure,
// edge-safe token crypto see ./token.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, type SessionUser } from "./token";

export {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type SessionUser,
} from "./token";

/** The current signed-in user (server components, actions, routes), or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get("sp_session")?.value;
  return verifySession(token);
}

/** Redirect to /login unless signed in; otherwise return the user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirect non-admins to the dashboard; return the admin user. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
