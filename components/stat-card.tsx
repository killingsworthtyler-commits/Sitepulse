export function StatCard({
  label,
  value,
  sub,
  accent = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "slate" | "emerald" | "amber" | "rose";
}) {
  const accentText = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  }[accent];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 ring-1 ring-slate-900/[0.02]">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`font-display mt-1.5 text-4xl font-bold leading-none tracking-tight ${accentText}`}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-xs font-medium text-slate-500">{sub}</p>}
    </div>
  );
}
