import { HEALTH_MAP } from "@/lib/health";
import { STAGE_MAP } from "@/lib/stages";
import { TEAM_MAP, teamForStage } from "@/lib/teams";
import type { Health, StageId } from "@/lib/types";
import type { TeamId } from "@/lib/teams";

export function HealthBadge({ health }: { health: Health }) {
  const h = HEALTH_MAP[health];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${h.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${h.dot}`} />
      {h.label}
    </span>
  );
}

export function StageBadge({ stage }: { stage: StageId }) {
  const s = STAGE_MAP[stage];
  const team = teamForStage(stage);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      <span className={`h-1.5 w-1.5 rounded-full ${team.color.dot}`} />
      {s.label}
    </span>
  );
}

export function TeamBadge({ team }: { team: TeamId }) {
  const t = TEAM_MAP[team];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${t.color.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.color.dot}`} />
      {t.label}
    </span>
  );
}
