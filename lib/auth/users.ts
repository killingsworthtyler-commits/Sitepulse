// The invite list. Membership is required to sign in (invite-only): a Microsoft
// login only succeeds if the email exists here. Admins manage the list from the
// Account tab. Server-only — never import from a client component.

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

export function authConfigured(): boolean {
  return !!sql;
}

export type Role = "admin" | "member";

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
  lastLogin: string | null;
}

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!sql) return Promise.reject(new Error("DATABASE_URL not configured"));
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_users (
          id         text PRIMARY KEY,
          email      text UNIQUE NOT NULL,
          name       text,
          role       text NOT NULL DEFAULT 'member',
          created_at timestamptz NOT NULL DEFAULT now(),
          last_login timestamptz
        )
      `;
      // Seed admins from ADMIN_EMAILS so the first people can get in + invite others.
      const seeds = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      for (const email of seeds) {
        await sql`
          INSERT INTO app_users (id, email, role)
          VALUES (${randomId()}, ${email}, 'admin')
          ON CONFLICT (email) DO UPDATE SET role = 'admin'
        `;
      }
    })();
  }
  return ready;
}

function randomId(): string {
  return "u_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

const norm = (e: string) => e.trim().toLowerCase();

interface Row {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string | Date;
  last_login: string | Date | null;
}
const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());
function toUser(r: Row): AppUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role === "admin" ? "admin" : "member",
    createdAt: iso(r.created_at),
    lastLogin: r.last_login ? iso(r.last_login) : null,
  };
}

/** The invited user for an email, or null if not invited (sign-in denied). */
export async function findUser(email: string): Promise<AppUser | null> {
  if (!sql) return null;
  await ensure();
  const rows = (await sql`SELECT * FROM app_users WHERE email = ${norm(email)}`) as Row[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<AppUser | null> {
  if (!sql) return null;
  await ensure();
  const rows = (await sql`SELECT * FROM app_users WHERE id = ${id}`) as Row[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function listUsers(): Promise<AppUser[]> {
  if (!sql) return [];
  await ensure();
  const rows = (await sql`SELECT * FROM app_users ORDER BY created_at`) as Row[];
  return rows.map(toUser);
}

/** Invite a user (admin action). Returns the created/existing user. */
export async function inviteUser(email: string, name: string, role: Role): Promise<AppUser> {
  if (!sql) throw new Error("Database not configured.");
  await ensure();
  await sql`
    INSERT INTO app_users (id, email, name, role)
    VALUES (${randomId()}, ${norm(email)}, ${name || null}, ${role})
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, app_users.name),
      role = EXCLUDED.role
  `;
  return (await findUser(email))!;
}

export async function removeUser(id: string): Promise<void> {
  if (!sql) throw new Error("Database not configured.");
  await ensure();
  await sql`DELETE FROM app_users WHERE id = ${id}`;
}

export async function setRole(id: string, role: Role): Promise<void> {
  if (!sql) throw new Error("Database not configured.");
  await ensure();
  await sql`UPDATE app_users SET role = ${role} WHERE id = ${id}`;
}

/** Record a successful login + backfill the name from the SSO profile. */
export async function touchLogin(id: string, name?: string | null): Promise<void> {
  if (!sql) return;
  await ensure();
  await sql`
    UPDATE app_users
    SET last_login = now(), name = COALESCE(name, ${name ?? null})
    WHERE id = ${id}
  `;
}
