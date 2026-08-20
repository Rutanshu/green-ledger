import { getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { setTaskStatus } from "./actions";

export const dynamic = "force-dynamic";

const PRIORITY_LABEL: Record<number, string> = { 1: "High", 2: "Medium", 3: "Low" };
const PRIORITY_STYLE: Record<number, string> = {
  1: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  2: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  3: "bg-track text-ink2",
};

export default async function TasksPage() {
  const org = await getCurrentOrg();
  if (!org) return null;
  const db = orgScopedClient(org.id);

  const tasks = await db.task.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });

  return (
    <>
      <h1 className="text-xl font-semibold">Tasks</h1>
      <p className="mt-0.5 text-[13px] text-ink2">Follow-ups generated from real state — a broken binding, a site that hasn&apos;t started.</p>

      {tasks.length === 0 ? (
        <p className="mt-5 rounded-[11px] border border-dashed border-border bg-surface p-4 text-[13px] text-muted">
          No open tasks.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-grid rounded-[11px] border border-border bg-surface">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-4 p-4">
              <div>
                <div className="text-[13px] font-medium">{t.title}</div>
                {t.description && <div className="mt-0.5 text-xs text-ink2">{t.description}</div>}
                <div className="mt-1 text-xs text-muted">{t.entityType} · {t.status}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE[3]}`}>
                  {PRIORITY_LABEL[t.priority] ?? "Low"}
                </span>
                <form action={setTaskStatus.bind(null, t.id, t.status === "DONE" ? "OPEN" : "DONE")}>
                  <button type="submit" className="whitespace-nowrap rounded-md border border-border px-2 py-1 text-xs hover:bg-track">
                    {t.status === "DONE" ? "Reopen" : "Mark done"}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
