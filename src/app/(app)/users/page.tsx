import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { Denied } from "../_components/Denied";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "manage_users")) return <Denied role={membership.role} />;

  const db = orgScopedClient(membership.org.id);
  const memberships = await db.membership.findMany({
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Users &amp; roles</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        {memberships.length} accounts in this organisation. Inviting a new person isn&apos;t built yet — these are the
        seeded demo accounts, one per role.
      </p>

      <div className="mt-5 overflow-x-auto rounded-[11px] glass">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-grid text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Member since</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => (
              <tr key={m.id} className="border-b border-grid last:border-0">
                <td className="px-4 py-2.5 font-medium">{m.user.name ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink2">{m.user.email}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-track px-2 py-0.5 text-xs font-medium text-ink2">{ROLE_LABEL[m.role]}</span>
                </td>
                <td className="px-4 py-2.5 text-ink2">{m.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
