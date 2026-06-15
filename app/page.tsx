import { getProjects } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import { StagePipeline } from "@/components/stage-pipeline";
import { ProjectsView } from "@/components/projects-view";

export default async function DashboardPage() {
  const projects = await getProjects();

  const total = projects.length;
  const onTrack = projects.filter((p) => p.health === "on_track").length;
  const atRisk = projects.filter((p) => p.health === "at_risk").length;
  const blocked = projects.filter((p) => p.health === "blocked").length;
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-blue opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full brand-gradient" />
          </span>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-ink">
            Development Pulse
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          Real Estate, Development &amp; Construction — every active project, at a glance.
        </p>
      </header>

      {/* KPI row */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Projects" value={String(total)} sub="Across all stages" />
        <StatCard
          label="On Track"
          value={String(onTrack)}
          sub="Healthy"
          accent="emerald"
        />
        <StatCard
          label="At Risk"
          value={String(atRisk)}
          sub="Needs attention"
          accent="amber"
        />
        <StatCard
          label="Blocked"
          value={String(blocked)}
          sub="Action required"
          accent="rose"
        />
      </section>

      {/* Pipeline funnel */}
      <section className="mb-6">
        <StagePipeline projects={projects} />
      </section>

      {/* Projects table */}
      <section>
        <ProjectsView projects={projects} />
      </section>
    </div>
  );
}
