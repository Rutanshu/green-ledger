"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";

export async function setTaskStatus(taskId: string, status: "OPEN" | "DONE") {
  const org = await getCurrentOrg();
  if (!org) return;
  const db = orgScopedClient(org.id);

  const task = await db.task.findFirst({ where: { id: taskId } });
  if (!task) return;

  await db.task.update({ where: { id: taskId }, data: { status } });
  revalidatePath("/tasks");
}
