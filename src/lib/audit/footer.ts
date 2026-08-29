/**
 * A two-line feature that answers an auditor's first question:
 * created-by/at and last-changed-by/at on any configuration detail
 * pane. Built entirely on AuditEvent, which every write path already
 * populates in the same transaction as the change (CLAUDE.md rule 7) —
 * no schema change, just reading what's already recorded.
 */
import { orgScopedClient } from "@/lib/db/tenant";

export interface AuditFooterData {
  createdBy: string;
  createdAt: string;
  changedBy: string | null;
  changedAt: string | null;
  eventCount: number;
}

export async function getAuditFooter(
  orgId: string,
  entityType: string,
  entityId: string,
): Promise<AuditFooterData | null> {
  const db = orgScopedClient(orgId);
  const events = await db.auditEvent.findMany({
    where: { entityType, entityId },
    orderBy: { occurredAt: "asc" },
  });
  if (events.length === 0) return null;

  const first = events[0];
  const last = events[events.length - 1];
  const userIds = [...new Set([first.actorUserId, last.actorUserId].filter((id): id is string => !!id))];
  const memberships = userIds.length
    ? await db.membership.findMany({ where: { userId: { in: userIds } }, include: { user: true } })
    : [];
  const nameById = new Map(memberships.map((m) => [m.userId, m.user.name ?? m.user.email]));

  return {
    createdBy: first.actorUserId ? (nameById.get(first.actorUserId) ?? "Unknown") : "System",
    createdAt: first.occurredAt.toISOString(),
    changedBy: events.length > 1 ? (last.actorUserId ? (nameById.get(last.actorUserId) ?? "Unknown") : "System") : null,
    changedAt: events.length > 1 ? last.occurredAt.toISOString() : null,
    eventCount: events.length,
  };
}
