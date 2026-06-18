// Scorecard persistence in Neon (serverless Postgres). Server-only — never
// import this from a client component; use the server actions instead.

import { neon } from "@neondatabase/serverless";
import type { SavedScorecard } from "@/lib/scorecard/saved";
import type { ScorecardInputs, Variant } from "@/lib/scorecard/modwash";

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

export function dbConfigured(): boolean {
  return !!sql;
}

// Create the table on first use (cached so it runs once per server lifetime).
let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!sql) return Promise.reject(new Error("DATABASE_URL not configured"));
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS scorecards (
        id         text PRIMARY KEY,
        name       text NOT NULL,
        address    text,
        variant    text NOT NULL,
        inputs     jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `.then(() => undefined);
  }
  return ready;
}

interface Row {
  id: string;
  name: string;
  address: string | null;
  variant: string;
  inputs: ScorecardInputs;
  created_at: string | Date;
  updated_at: string | Date;
}

const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());

function toScorecard(r: Row): SavedScorecard {
  return {
    id: r.id,
    name: r.name,
    address: r.address ?? undefined,
    variant: r.variant as Variant,
    inputs: r.inputs,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export async function dbListScorecards(): Promise<SavedScorecard[]> {
  if (!sql) return [];
  await ensure();
  const rows = (await sql`
    SELECT id, name, address, variant, inputs, created_at, updated_at
    FROM scorecards
    ORDER BY updated_at DESC
  `) as Row[];
  return rows.map(toScorecard);
}

export async function dbUpsertScorecard(sc: SavedScorecard): Promise<void> {
  if (!sql) throw new Error("Database not configured.");
  await ensure();
  await sql`
    INSERT INTO scorecards (id, name, address, variant, inputs, created_at, updated_at)
    VALUES (
      ${sc.id}, ${sc.name}, ${sc.address ?? null}, ${sc.variant},
      ${JSON.stringify(sc.inputs)}::jsonb, ${sc.createdAt}, ${sc.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      address = EXCLUDED.address,
      variant = EXCLUDED.variant,
      inputs = EXCLUDED.inputs,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function dbDeleteScorecard(id: string): Promise<void> {
  if (!sql) throw new Error("Database not configured.");
  await ensure();
  await sql`DELETE FROM scorecards WHERE id = ${id}`;
}
