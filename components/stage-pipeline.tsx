import { STAGE_MAP, STAGES } from "@/lib/stages";
import { TEAMS } from "@/lib/teams";
import type { Project } from "@/lib/types";

/** Pipeline grouped by team — shows the Real Estate → Development → Construction
    handoff, with project counts at each stage within each team. */
export function StagePipeline({ projects }: { projects: Project[] }) {
  const max = Math.max(
    1,
    ...STAGES.map((s) => projects.filter((p) => p.stage === s.id).length),
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">
          Pipeline by team
        </h2>
        <span className="text-xs text-slate-400">
          {projects.length} active projects
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {TEAMS.map((team) => {
          const teamCount = projects.filter((p) =>
            team.stages.includes(p.stage),
          ).length;

          return (
            <div
              key={team.id}
              className={`rounded-lg border-t-2 bg-slate-50/60 p-3 ${team.color.border}`}
            >
              <div className="mb-3 flex items-baseline justify-between">
                <div>
                  <p className={`text-sm font-semibold ${team.color.text}`}>
                    {team.label}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {team.responsibility}
                  </p>
                </div>
                <span className="text-lg font-semibold text-slate-700 tabular-nums">
                  {teamCount}
                </span>
              </div>

              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${team.stages.length}, minmax(0, 1fr))` }}
              >
                {team.stages.map((stageId) => {
                  const count = projects.filter((p) => p.stage === stageId).length;
                  return (
                    <div key={stageId} className="flex flex-col">
                      <span className="mb-1 text-center text-xs font-semibold text-slate-700 tabular-nums">
                        {count}
                      </span>
                      <div className="flex h-12 w-full items-end">
                        <div
                          className={`w-full rounded-t ${team.color.bar}`}
                          style={{
                            height: `${(count / max) * 100}%`,
                            minHeight: count ? 5 : 0,
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-center text-[10px] leading-tight text-slate-500">
                        {STAGE_MAP[stageId].short}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
