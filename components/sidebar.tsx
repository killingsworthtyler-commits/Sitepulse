import Link from "next/link";

type NavItem = { label: string; href: string; soon?: boolean; active?: boolean };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", active: true },
  { label: "Projects", href: "/", },
  { label: "Site Scorecards", href: "/", soon: true },
  { label: "Stages", href: "/", soon: true },
  { label: "Reports", href: "/", soon: true },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-line bg-ink px-4 py-6 md:flex">
      <div className="flex items-center gap-2.5 px-2">
        <PulseMark />
        <div className="leading-none">
          <p className="font-display text-xl font-bold uppercase tracking-wide text-white">
            Site Pulse
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            by Hutton
          </p>
        </div>
      </div>

      <nav className="mt-8 flex flex-col gap-1">
        {NAV.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              item.active
                ? "bg-ink-soft font-semibold text-white"
                : "text-slate-400 hover:bg-ink-soft/60 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2.5">
              {item.active && (
                <span className="h-4 w-1 rounded-full brand-gradient" />
              )}
              {item.label}
            </span>
            {item.soon && (
              <span className="rounded bg-ink-soft px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">
                Soon
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-auto rounded-lg bg-ink-soft/50 p-3">
        <p className="text-xs font-medium text-slate-300">Tyler Killingsworth</p>
        <p className="text-[11px] text-slate-500">Development</p>
      </div>
    </aside>
  );
}

/** A pulse / heartbeat line mark in the Hutton brand gradient. */
function PulseMark() {
  return (
    <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg shadow-sm">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h3l2-5 4 10 2-5h7" />
      </svg>
    </div>
  );
}
