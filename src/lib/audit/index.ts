/**
 * ARCHITECTURE.md: "Audit writes are never optional and never
 * async-fire-and-forget." recordAudit() takes the transaction client so
 * every call site writes the event in the same transaction as the change
 * it describes — call it from inside a $transaction, never after one.
 */

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOCK' | 'UNLOCK' | 'APPROVE' | 'REJECT'
  | 'RECALCULATE' | 'EXPORT' | 'LOGIN' | 'IMPORT' | 'RESTATE';

interface AuditEventClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditEvent: { create: (args: any) => Promise<unknown> };
}

export async function recordAudit(
  tx: AuditEventClient,
  params: {
    organizationId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    actorUserId?: string | null;
  },
) {
  await tx.auditEvent.create({
    data: {
      organizationId: params.organizationId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before === undefined ? undefined : (params.before ?? null),
      after: params.after === undefined ? undefined : (params.after ?? null),
      actorUserId: params.actorUserId ?? null,
    },
  });
}
