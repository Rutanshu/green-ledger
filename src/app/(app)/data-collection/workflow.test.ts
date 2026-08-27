/**
 * Integration test against the real (seeded, live) database — calls
 * submitAssignment/approveAssignment directly, same pattern as
 * actions.test.ts. Covers BUILD_PLAN Step 3.2's acceptance criteria:
 * submission below 100% completeness is refused, and four-eyes blocks
 * self-approval.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { adminPrisma as rawPrisma } from '@/lib/db/admin-client';

let orgId: string;
let sessionOrgId: string;
let sessionUserId: string;
let approverUserId: string;
let assignmentId: string;
let originalStatus: string;
let originalCompletenessPct: string;
let originalSubmittedById: string | null;
let originalApproverId: string | null;

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === 'gl_org') return { value: sessionOrgId };
      if (name === 'gl_user') return { value: sessionUserId };
      return undefined;
    },
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({ redirect: () => {} }));

const { submitAssignment, approveAssignment } = await import('./actions');

beforeAll(async () => {
  const org = await rawPrisma.organization.findFirstOrThrow({ where: { legalName: 'Meridian Industries (Demo)' } });
  orgId = org.id;
  sessionOrgId = orgId;

  const dataManager = await rawPrisma.membership.findFirstOrThrow({ where: { organizationId: orgId, role: 'DATA_MANAGER' } });
  sessionUserId = dataManager.userId;
  const superAdmin = await rawPrisma.membership.findFirstOrThrow({ where: { organizationId: orgId, role: 'SUPER_ADMIN' } });
  approverUserId = superAdmin.userId;

  const site = await rawPrisma.site.findFirstOrThrow({ where: { organizationId: orgId, code: 'MI-CW-07' } });
  const assignment = await rawPrisma.questionnaireAssignment.findFirstOrThrow({ where: { siteId: site.id } });
  assignmentId = assignment.id;
  originalStatus = assignment.status;
  originalCompletenessPct = assignment.completenessPct.toString();
  originalSubmittedById = assignment.submittedById;
  originalApproverId = assignment.approverId;
});

afterAll(async () => {
  await rawPrisma.questionnaireAssignment.update({
    where: { id: assignmentId },
    data: {
      status: originalStatus as never,
      completenessPct: originalCompletenessPct,
      submittedById: originalSubmittedById,
      approverId: originalApproverId,
      submittedAt: null,
      approvedAt: null,
    },
  });
  await rawPrisma.$disconnect();
});

describe('submitAssignment', () => {
  it('refuses submission below 100% completeness', async () => {
    await rawPrisma.questionnaireAssignment.update({ where: { id: assignmentId }, data: { status: 'IN_PROGRESS', completenessPct: 50 } });
    const result = await submitAssignment(assignmentId);
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/100%/);

    const row = await rawPrisma.questionnaireAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    expect(row.status).toBe('IN_PROGRESS');
  });

  it('submits at 100% completeness and records who submitted it', async () => {
    await rawPrisma.questionnaireAssignment.update({ where: { id: assignmentId }, data: { status: 'IN_PROGRESS', completenessPct: 100 } });
    const result = await submitAssignment(assignmentId);
    expect(result?.ok).toBe(true);

    const row = await rawPrisma.questionnaireAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    expect(row.status).toBe('IN_REVIEW');
    expect(row.submittedById).toBe(sessionUserId);
  });
});

describe('approveAssignment — four-eyes', () => {
  it('refuses self-approval', async () => {
    // sessionUserId is the same person who just submitted it above.
    const result = await approveAssignment(assignmentId);
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/different person/i);

    const row = await rawPrisma.questionnaireAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    expect(row.status).toBe('IN_REVIEW');
  });

  it('approves when a different person decides it', async () => {
    sessionUserId = approverUserId;
    try {
      const result = await approveAssignment(assignmentId);
      expect(result?.ok).toBe(true);

      const row = await rawPrisma.questionnaireAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
      expect(row.status).toBe('APPROVED');
      expect(row.approverId).toBe(approverUserId);
    } finally {
      const dataManager = await rawPrisma.membership.findFirstOrThrow({ where: { organizationId: orgId, role: 'DATA_MANAGER' } });
      sessionUserId = dataManager.userId;
    }
  });
});
