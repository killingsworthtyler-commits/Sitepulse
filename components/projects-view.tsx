"use client";

import { useMemo, useState } from "react";
import { HealthBadge, StageBadge, TeamBadge } from "@/components/badges";
import { HEALTH_MAP, HEALTH_ORDER } from "@/lib/health";
import { STAGES } from "@/lib/stages";
import { TEAMS, teamForStage } from "@/lib/teams";
import { money, shortDate, daysUntil } from "@/lib/format";
import type { Health, Project } from "@/lib/types";
import type { TeamId } from "@/lib/teams";

export function ProjectsView({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<Health | "all">("all");
  const [team, setTeam] = useState<TeamId | "all">("all");
  const [stage, setStage] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (health !== "all" && p.health !== health) return false;
      if (team !== "all" && teamForStage(p.stage).id !== team) return false;
      if (stage !== "all" && p.stage !== stage) return false;
      if (
        q &&
        !`${p.name} ${p.tenant} ${p.city} ${p.state} ${p.owner}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [projects, query, health, team, stage]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">
            Projects
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 tabular-nums">
            {filtered.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, tenants, cities…"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue sm:w-64"
          />

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
            <FilterChip active={health === "all"} onClick={() => setHealth("all")}>
              All
            </FilterChip>
            {HEALTH_ORDER.map((h) => (
              <FilterChip
                key={h}
                active={health === h}
                onClick={() => setHealth(h)}
              >
                {HEALTH_MAP[h].label}
              </FilterChip>
            ))}
          </div>

          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="all">All stages</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Team filter — the primary lens for RE / Development / Construction */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          Team
        </span>
        <TeamFilterChip active={team === "all"} onClick={() => setTeam("all")}>
          All teams
        </TeamFilterChip>
        {TEAMS.map((t) => (
          <TeamFilterChip
            key={t.id}
            active={team === t.id}
            onClick={() => setTeam(t.id)}
            dot={t.color.dot}
          >
            {t.label}
          </TeamFilterChip>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Project</th>
              <th className="px-4 py-2.5 font-medium">Team</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 font-medium">Health</th>
              <th className="px-4 py-2.5 font-medium">Progress</th>
              <th className="px-4 py-2.5 font-medium">Value</th>
              <th className="px-4 py-2.5 font-medium">Next milestone</th>
              <th className="px-4 py-2.5 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.id}
                className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/70"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {p.tenant} · {p.city}, {p.state}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <TeamBadge team={teamForStage(p.stage).id} />
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={p.stage} />
                </td>
                <td className="px-4 py-3">
                  <HealthBadge health={p.health} />
                </td>
                <td className="px-4 py-3">
                  <ProgressBar value={p.progress} />
                </td>
                <td className="px-4 py-3 font-medium text-slate-700 tabular-nums">
                  {money(p.value)}
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{p.nextMilestone.label}</p>
                  <p className="text-xs text-slate-400">
                    {shortDate(p.nextMilestone.date)} · {dueLabel(p.nextMilestone.date)}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.owner}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                  No projects match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function TeamFilterChip({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {children}
    </button>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-blue"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 tabular-nums">{value}%</span>
    </div>
  );
}

function dueLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "today";
  return `in ${d}d`;
}
