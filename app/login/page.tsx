import Link from "next/link";

export const metadata = { title: "Sign in — SITE PULSE" };

const ERRORS: Record<string, string> = {
  "not-invited": "That account isn't on the access list. Ask an admin to invite your email.",
  state: "Sign-in expired or was interrupted. Please try again.",
  auth: "Microsoft sign-in failed. Please try again.",
  config: "Sign-in isn't fully configured yet. Contact your administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? "Something went wrong. Please try again." : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="brand-gradient mb-4 flex h-12 w-12 items-center justify-center rounded-xl shadow-lg">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h3l2-5 4 10 2-5h7" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-white">
            Site Pulse
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            by Hutton
          </p>
        </div>

        <div className="rounded-2xl border border-ink-line bg-ink-soft/40 p-6 shadow-xl">
          <p className="mb-5 text-center text-sm text-slate-300">
            Sign in with your Hutton Microsoft account.
          </p>

          {message && (
            <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {message}
            </p>
          )}

          <Link
            href="/api/auth/login"
            className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-100"
          >
            <svg viewBox="0 0 21 21" className="h-4 w-4" aria-hidden>
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            Sign in with Microsoft
          </Link>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-600">
          Access is invite-only. Contact an admin to be added.
        </p>
      </div>
    </div>
  );
}
