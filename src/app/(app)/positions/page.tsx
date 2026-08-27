import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { Denied } from "../_components/Denied";
import { CreatePositionForm } from "./CreatePositionForm";
import { AssignForm } from "./AssignForm";
import { endAssignment, deleteResponsibility } from "./actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  DATA_OWNER: "Data owner",
  REVIEWER: "Reviewer",
  APPROVER: "Approver",
  SITE_MANAGER: "Site manager",
  CATEGORY_OWNER: "Category owner",
  OTHER: "Other",
};

export default async function PositionsPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "manage_sites")) return <Denied role={membership.role} />;
  const canEdit = can(membership.role, "manage_sites");
  const orgId = membership.org.id;
  const db = orgScopedClient(orgId);

  const [responsibilities, sites, members] = await Promise.all([
    db.responsibility.findMany({
      include: {
        site: { select: { name: true, code: true } },
        assignments: {
          where: { endedOn: null },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.site.findMany({ select: { id: true, name: true, code: true }, orderBy: { code: "asc" } }),
    db.membership.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const memberOptions = members.map((m) => ({ id: m.user.id, label: m.user.name ?? m.user.email }));
  const vacant = responsibilities.filter((p) => !p.assignments.some((a) => !a.isBackup));

  return (
    <>
      <h1 className="text-xl font-semibold">Responsibilities</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        A stable responsibility — &ldquo;Site Data Owner, Ashford&rdquo; — independent of whoever holds it right
        now. Reassign it when someone leaves; the responsibility itself never disappears.
      </p>

      {vacant.length > 0 && (
        <div className="mt-4 rounded-[11px] border border-warn/40 bg-warn/10 p-3 text-[13px] text-ink">
          <span className="font-medium">{vacant.length} vacant responsibilit{vacant.length === 1 ? "y" : "ies"}</span> —{" "}
          {vacant.map((p) => p.title).join(", ")}
        </div>
      )}

      {canEdit && (
        <div className="mt-5">
          <CreatePositionForm sites={sites} />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {responsibilities.map((p) => {
          const primary = p.assignments.find((a) => !a.isBackup);
          const backup = p.assignments.find((a) => a.isBackup);
          return (
            <div key={p.id} className="glass rounded-[11px] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {p.title}{" "}
                    <span className="font-normal text-muted">
                      · {TYPE_LABEL[p.type]}
                      {p.site && ` · ${p.site.name} (${p.site.code})`}
                    </span>
                  </div>
                  {p.description && <div className="mt-0.5 text-xs text-ink2">{p.description}</div>}
                </div>
                {canEdit && (
                  <form action={deleteResponsibility.bind(null, p.id)}>
                    <button type="submit" className="text-xs text-muted hover:text-crit">
                      Delete
                    </button>
                  </form>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-track p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted">Current holder</div>
                  {primary ? (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[13px]">{primary.user.name ?? primary.user.email}</span>
                      {canEdit && (
                        <form action={endAssignment.bind(null, primary.id)}>
                          <button type="submit" className="text-xs text-muted hover:text-crit">
                            End
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 text-[13px] text-warn">Vacant</div>
                  )}
                  {canEdit && <AssignForm responsibilityId={p.id} isBackup={false} members={memberOptions} />}
                </div>

                <div className="rounded-md bg-track p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted">Backup</div>
                  {backup ? (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[13px]">{backup.user.name ?? backup.user.email}</span>
                      {canEdit && (
                        <form action={endAssignment.bind(null, backup.id)}>
                          <button type="submit" className="text-xs text-muted hover:text-crit">
                            End
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 text-[13px] text-muted">None</div>
                  )}
                  {canEdit && <AssignForm responsibilityId={p.id} isBackup={true} members={memberOptions} />}
                </div>
              </div>
            </div>
          );
        })}
        {responsibilities.length === 0 && <p className="text-[13px] text-muted">No responsibilities yet.</p>}
      </div>
    </>
  );
}
