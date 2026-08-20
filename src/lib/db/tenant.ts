/**
 * Layer 1 of tenant isolation (ARCHITECTURE.md "Multi-tenancy — belt and
 * braces"). orgScopedClient(orgId) returns a Prisma client that injects
 * organization_id into every where/create for the models listed below, and
 * sets `app.org_id` for the session so Postgres RLS (layer 2, see the
 * `_org_scoping_rls` migration) enforces the same boundary independently.
 *
 * Layer 1 catches developer mistakes. Layer 2 catches layer 1's mistakes.
 * Never import `rawPrisma` directly from app code — always go through this.
 */
import { rawPrisma } from './client';

/** Models with a required organization_id: every row belongs to exactly one org. */
const STRICT_ORG_MODELS = new Set([
  'Membership', 'LabelOverride', 'Site', 'SiteAsset', 'ReportingPeriod',
  'QuestionnaireTemplate', 'Document', 'Task', 'AuditEvent', 'Target',
  'Report', 'ImportBatch', 'ActivityRecord',
]);

/**
 * Models with a nullable organization_id: null rows are system-seeded /
 * shared reference data (vocabulary, published factor sets) visible to
 * every org alongside that org's own rows.
 */
const SHARED_OR_ORG_MODELS = new Set(['VocabularyEntry', 'EmissionFactorSet', 'FuelProperty']);

/**
 * Models scoped to an org only transitively, through a relation (e.g.
 * EmissionFactor -> EmissionFactorSet, Question -> QuestionnaireSection ->
 * QuestionnaireTemplate). This extension does not scope them yet — query
 * through their scoped parent, or extend this file with relation-aware
 * where-injection before querying them directly.
 */

const READ_OPS = new Set([
  'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow',
  'findMany', 'count', 'aggregate', 'groupBy',
]);
const WHERE_WRITE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

function scopeWhere(where: unknown, orgId: string, shared: boolean) {
  const condition = shared
    ? { OR: [{ organizationId: null }, { organizationId: orgId }] }
    : { organizationId: orgId };
  return where ? { AND: [where, condition] } : condition;
}

export function orgScopedClient(orgId: string) {
  if (!orgId) throw new Error('orgScopedClient() requires a non-empty organisation id.');
  const escapedOrgId = orgId.replace(/'/g, "''");

  return rawPrisma.$extends({
    name: 'org-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args }) {
          const strict = STRICT_ORG_MODELS.has(model);
          const shared = SHARED_OR_ORG_MODELS.has(model);
          const scopedArgs = args as Record<string, unknown>;

          if (strict || shared) {
            if (READ_OPS.has(operation) || WHERE_WRITE_OPS.has(operation)) {
              scopedArgs.where = scopeWhere(scopedArgs.where, orgId, shared);
            }
            if (CREATE_OPS.has(operation)) {
              scopedArgs.data = Array.isArray(scopedArgs.data)
                ? scopedArgs.data.map((d) => ({ ...d, organizationId: orgId }))
                : { ...(scopedArgs.data as object), organizationId: orgId };
            }
            if (operation === 'upsert') {
              scopedArgs.where = scopeWhere(scopedArgs.where, orgId, shared);
              scopedArgs.create = { ...(scopedArgs.create as object), organizationId: orgId };
            }
          }

          // Every operation runs inside its own transaction so SET LOCAL and
          // the query itself share one connection — required for RLS to see it.
          return rawPrisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
            const accessor = model.charAt(0).toLowerCase() + model.slice(1);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (tx as any)[accessor][operation](scopedArgs);
          });
        },
      },
    },
  });
}
