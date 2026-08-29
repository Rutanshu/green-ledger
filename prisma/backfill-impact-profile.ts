/**
 * One-off backfill: the demo org's "Standard Operations" template was
 * created directly with status: 'PUBLISHED' by prisma/seed.ts, which
 * skips the ImpactProfile-snapshot step that src/app/(app)/builder/
 * actions.ts's publishTemplate() normally performs on every real publish
 * (see that file, lines ~148-193). Confirmed live: zero ImpactProfile
 * rows exist for this org despite 30 live FactorBindings — the audit
 * trail answering "what were our bindings the day we published this"
 * has never actually been populated.
 *
 * This mirrors publishTemplate's snapshot logic exactly (same shape,
 * same dedupe-by-position-id rule) without its broken-binding publish
 * gate — that gate exists to stop a NEW publish from going out broken,
 * not to refuse recording an honest snapshot of what's already live,
 * broken bindings (cleaning_spend, deliberately) included.
 *
 * Additive and idempotent: does nothing if the org already has an
 * ACTIVE ImpactProfile whose assignments already match the live
 * bindings exactly (via impactProfile.ts's own diffProfiles).
 *
 * Run with: npx tsx prisma/backfill-impact-profile.ts
 */
import { adminPrisma } from '../src/lib/db/admin-client';
import { activateProfile, supersedeProfile, diffProfiles, type FactorAssignmentLike } from '../src/lib/factors/impactProfile';
import { recordAudit } from '../src/lib/audit';

const prisma = adminPrisma;

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { legalName: 'Meridian Industries (Demo)' } });
  const superAdmin = await prisma.membership.findFirstOrThrow({ where: { organizationId: org.id, role: 'SUPER_ADMIN' }, include: { user: true } });

  const templates = await prisma.questionnaireTemplate.findMany({
    where: { organizationId: org.id, status: 'PUBLISHED' },
    include: {
      sections: {
        include: {
          questions: { include: { binding: true } },
          items: { include: { position: { include: { binding: true } } } },
        },
      },
    },
  });

  for (const template of templates) {
    const boundQuestions = template.sections
      .flatMap((s) => s.questions)
      .filter((q): q is typeof q & { binding: NonNullable<typeof q.binding> } => q.binding !== null)
      .map((q) => ({ code: q.code, binding: q.binding }));
    const boundPositions = [...new Map(
      template.sections
        .flatMap((s) => s.items)
        .filter((i): i is typeof i & { position: typeof i.position & { binding: NonNullable<typeof i.position.binding> } } => i.position.binding !== null)
        .map((i) => [i.position.id, { code: i.position.positionCode, binding: i.position.binding }] as const),
    ).values()];
    const allBound = [...boundQuestions, ...boundPositions];

    if (allBound.length === 0) {
      console.log(`${template.name} v${template.version}: no bound questions/positions — skipping.`);
      continue;
    }

    const nextAssignments: FactorAssignmentLike[] = allBound.map(({ code, binding: b }) => ({
      positionCode: code,
      scope: b.scope,
      scope3Category: b.scope3Category,
      activityType: b.activityType,
      method: b.method,
      fuelOrMaterialCode: b.fuelOrMaterialCode,
      regionStrategy: b.regionStrategy,
      outputBasis: b.outputBasis,
    }));

    const prevActive = await prisma.impactProfile.findFirst({
      where: { organizationId: org.id, name: template.name, status: 'ACTIVE' },
      include: { assignments: true },
    });

    if (prevActive) {
      const diff = diffProfiles(prevActive.assignments, nextAssignments);
      if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
        console.log(`${template.name} v${template.version}: ACTIVE profile v${prevActive.version} already matches live bindings exactly. Skipping.`);
        continue;
      }
      console.log(`${template.name} v${template.version}: ACTIVE profile v${prevActive.version} is stale (+${diff.added.length} / -${diff.removed.length} / ~${diff.changed.length}) — superseding.`);
    } else {
      console.log(`${template.name} v${template.version}: no ImpactProfile exists yet — creating the first one.`);
    }

    await prisma.$transaction(async (tx) => {
      const escapedOrgId = org.id.replace(/'/g, "''");
      await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);

      if (prevActive) {
        await tx.impactProfile.update({
          where: { id: prevActive.id },
          data: { status: supersedeProfile(prevActive.status as 'ACTIVE'), supersededAt: new Date() },
        });
      }
      const lastVersion = await tx.impactProfile.findFirst({
        where: { organizationId: org.id, name: template.name },
        orderBy: { version: 'desc' },
      });
      const profile = await tx.impactProfile.create({
        data: {
          organizationId: org.id,
          name: template.name,
          version: (lastVersion?.version ?? 0) + 1,
          status: activateProfile('DRAFT'),
          activatedAt: new Date(),
          assignments: { create: nextAssignments as never },
        },
      });
      await recordAudit(tx, {
        organizationId: org.id,
        actorUserId: superAdmin.user.id,
        action: 'CREATE',
        entityType: 'ImpactProfile',
        entityId: profile.id,
        after: profile,
      });
      console.log(`  created ${template.name} v${profile.version}, ACTIVE, ${nextAssignments.length} assignments.`);
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
