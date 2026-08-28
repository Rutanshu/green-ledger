"use server";

import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/demo-org";
import { getSessionOrgId, getImpersonator, startImpersonation, stopImpersonation } from "@/lib/session";
import { rawPrisma } from "@/lib/db/client";
import { withOrgTransaction } from "@/lib/db/tenant";
import { recordAudit } from "@/lib/audit";
import { can } from "@/lib/auth/permissions";

/** Super Admin only, checked against the real (pre-impersonation) identity. */
export async function beginImpersonation(membershipId: string) {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership.role, "manage_platform")) {
    throw new Error("Not allowed.");
  }
  const target = await rawPrisma.membership.findUniqueOrThrow({
    where: { id: membershipId },
    include: { user: true },
  });

  await startImpersonation({ orgId: target.organizationId, userId: target.userId });
  await withOrgTransaction(target.organizationId, (tx) =>
    recordAudit(tx, {
      organizationId: target.organizationId,
      actorUserId: membership.user.id,
      action: "IMPERSONATE",
      entityType: "Membership",
      entityId: target.id,
      after: { impersonating: target.user.email, startedBy: membership.user.email },
    }),
  );
  redirect("/");
}

export async function endImpersonation() {
  const impersonator = await getImpersonator();
  if (!impersonator) return;
  const currentOrgId = await getSessionOrgId();
  if (currentOrgId) {
    await withOrgTransaction(currentOrgId, (tx) =>
      recordAudit(tx, {
        organizationId: currentOrgId,
        actorUserId: impersonator.userId,
        action: "IMPERSONATE",
        entityType: "Membership",
        entityId: "stop",
        after: { stopped: true },
      }),
    );
  }
  await stopImpersonation();
  redirect("/platform");
}
