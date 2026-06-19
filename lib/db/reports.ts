// Generated-report cache in Neon. A site report makes many external calls
// (Census, Google Places, OpenRouteService, Anthropic) — some billed — so once
// built we cache the whole SiteReport JSON and serve that on later views.
// Keyed by normalized address + deal type. Server-only.

import { neon } from "@neondatabase/serverless";
import type { SiteReport } from "@/lib/report/build";

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

export function reportsConfigured(): boolean {
  return !!sql;
}

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!sql) return Promise.reject(new Error("DATABASE_URL not configured"));
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS site_reports (
        key        text PRIMARY KEY,
        address    text NOT NULL,
        deal_type  text NOT NULL,
        report     jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `.then(() => undefined);
  }
  return ready;
}

/** Stable cache key: deal type + trade-area spec + normalized address. */
function keyFor(address: string, dealType: string, taKey: string): string {
  return `${dealType}::${taKey}::${address.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export interface CachedReport {
  report: SiteReport;
  generatedAt: string;
}

export async function dbGetReport(
  address: string,
  dealType: string,
  taKey: string,
): Promise<CachedReport | null> {
  if (!sql) return null;
  await ensure();
  const rows = (await sql`
    SELECT report, created_at FROM site_reports WHERE key = ${keyFor(address, dealType, taKey)}
  `) as { report: SiteReport; created_at: string | Date }[];
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    report: r.report,
    generatedAt: r.created_at instanceof Date ? r.created_at.toISOString() : new Date(r.created_at).toISOString(),
  };
}

export async function dbSaveReport(
  address: string,
  dealType: string,
  taKey: string,
  report: SiteReport,
): Promise<void> {
  if (!sql) return;
  await ensure();
  await sql`
    INSERT INTO site_reports (key, address, deal_type, report, created_at)
    VALUES (${keyFor(address, dealType, taKey)}, ${address}, ${dealType}, ${JSON.stringify(report)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET
      report = EXCLUDED.report,
      created_at = now()
  `;
}

export async function dbDeleteReport(address: string, dealType: string, taKey: string): Promise<void> {
  if (!sql) return;
  await ensure();
  await sql`DELETE FROM site_reports WHERE key = ${keyFor(address, dealType, taKey)}`;
}
