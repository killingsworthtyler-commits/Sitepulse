import { requireUser } from "@/lib/auth/session";
import { listUsers } from "@/lib/auth/users";
import { inviteUserAction, removeUserAction, setRoleAction } from "./actions";

export const metadata = { title: "Account — SITE PULSE" };

function initials(name: string | null, email: string): string {
  const base = (name || email).trim();
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base[0]?.toUpperCase() || "?";
}

export default async function AccountPage() {
  const me = await requireUser();
  const isAdmin = me.role === "admin";
  const users = isAdmin ? await listUsers() : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">Account</h1>

      {/* Profile */}
      <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 ring-1 ring-slate-900/[0.02]">
        <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white">
          {initials(me.name, me.email)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{me.name || me.email}</p>
          <p className="text-sm text-slate-500">{me.email}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {me.role}
        </span>
        <a
          href="/api/auth/logout"
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Sign out
        </a>
      </div>

      {/* Admin: user management */}
      {isAdmin && (
        <section className="mt-8">
          <h2 className="font-display mb-1 text-xl font-bold uppercase tracking-wide text-ink">
            Team Access
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Invite-only. Add a teammate&apos;s Microsoft email below — they can then sign in.
          </p>

          {/* Invite form */}
          <form
            action={inviteUserAction}
            className="mb-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 ring-1 ring-slate-900/[0.02] sm:flex-row sm:items-center"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="name@hutton.build"
              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
            <input
              name="name"
              placeholder="Full name (optional)"
              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
            <select
              name="role"
              defaultValue="member"
              className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:border-brand-blue focus:outline-none"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              className="brand-gradient rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
            >
              Invite
            </button>
          </form>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Last login</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = u.id === me.sub;
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2">
                        <span className="font-medium text-slate-900">{u.name || u.email}</span>
                        {self && <span className="ml-1.5 text-[11px] text-slate-400">(you)</span>}
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-2">
                        {self ? (
                          <span className="text-xs font-semibold uppercase text-slate-500">{u.role}</span>
                        ) : (
                          <form action={setRoleAction} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={u.id} />
                            <select
                              name="role"
                              defaultValue={u.role}
                              className="rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-700"
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button className="text-[11px] font-semibold text-brand-blue hover:underline">
                              Save
                            </button>
                          </form>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {u.lastLogin
                          ? new Date(u.lastLogin).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {!self && (
                          <form action={removeUserAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <button className="text-[11px] font-semibold text-rose-600 hover:underline">
                              Remove
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
