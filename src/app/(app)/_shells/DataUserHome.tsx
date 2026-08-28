import Link from "next/link";
import { orgScopedClient } from "@/lib/db/tenant";
import type { CurrentMembership } from "@/lib/demo-org";

async function getHomeData(membership: CurrentMembership) {
  const db = orgScopedClient(membership.org.id);

  const [openTasks, recent] = await Promise.all([
    db.task.findMany({
      where: { assigneeId: membership.user.id, status: "OPEN" },
      orderBy: [{ priority: "asc" }, { dueOn: "asc" }],
    }),
    db.positionValue.findMany({
      where: { answeredById: membership.user.id, site: { organizationId: membership.org.id } },
      include: { position: true, site: true },
      orderBy: { answeredAt: "desc" },
      take: 5,
    }),
  ]);

  return { openTasks, recent };
}

export async function DataUserHome({ membership }: { membership: CurrentMembership }) {
  const { openTasks, recent } = await getHomeData(membership);

  return (
    <>
      <h1 className="text-xl font-semibold">
        {membership.user.name ? `Welcome back, ${membership.user.name.split(" ")[0]}` : "Welcome back"}
      </h1>
      <p className="mt-1 text-[15px] text-ink2">
        {openTasks.length === 0
          ? "Nothing due right now."
          : `You have ${openTasks.length} item${openTasks.length === 1 ? "" : "s"} due.`}
      </p>

      <div className="mt-5 flex flex-col gap-2.5">
        {openTasks.length === 0 ? (
          <div className="rounded-[11px] border border-dashed border-border bg-surface p-5 text-center text-[14px] text-muted">
            All caught up — check back when new data is due.
          </div>
        ) : (
          openTasks.map((t) => (
            <div key={t.id} className="glass flex items-center justify-between gap-3 rounded-[12px] p-4">
              <div>
                <div className="text-[15px] font-medium">{t.title}</div>
                {t.description && <div className="mt-0.5 text-[13px] text-ink2">{t.description}</div>}
                {t.dueOn && (
                  <div className="mt-1 text-[12.5px] text-muted">
                    Due {t.dueOn.toISOString().slice(0, 10)}
                  </div>
                )}
              </div>
              <Link
                href="/enter-data"
                className="whitespace-nowrap rounded-lg bg-accent px-3.5 py-2 text-[13.5px] font-semibold text-white"
              >
                Enter data
              </Link>
            </div>
          ))
        )}
      </div>

      <h2 className="mb-2.5 mt-8 text-[14.5px] font-semibold">Recently submitted</h2>
      {recent.length === 0 ? (
        <p className="text-[13.5px] text-muted">Nothing submitted yet.</p>
      ) : (
        <div className="glass divide-y divide-grid rounded-[12px]">
          {recent.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 p-3.5 text-[13.5px]">
              <div>
                <span className="font-medium">{v.position.labelKey}</span>{" "}
                <span className="text-muted">— {v.site.name}</span>
              </div>
              <div className="flex items-center gap-2 text-ink2">
                <span>
                  {v.valueNumeric?.toString()} {v.unit}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    v.status === "DRAFT" ? "bg-track text-ink2" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  }`}
                >
                  {v.status === "DRAFT" ? "Draft" : "Saved"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Link href="/enter-data" className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white">
          Enter data
        </Link>
        <Link href="/import" className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-medium">
          Upload a file
        </Link>
      </div>
    </>
  );
}
