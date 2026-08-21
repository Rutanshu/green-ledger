"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient, withOrgTransaction } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

export async function setTaskStatus(taskId: string, status: "OPEN" | "DONE") {
  const membership = await getCurrentMembership();
  if (!membership) return;
  if (!can(membership.role, "manage_tasks")) return; // UI already hides this control for other roles
  const org = membership.org;
  const db = orgScopedClient(org.id);

  const task = await db.task.findFirst({ where: { id: taskId } });
  if (!task) return;

  await db.task.update({ where: { id: taskId }, data: { status } });
  await withOrgTransaction(org.id, (tx) =>
    recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "UPDATE",
      entityType: "Task",
      entityId: taskId,
      before: { status: task.status },
      after: { status },
    }),
  );
  revalidatePath("/tasks");
}
