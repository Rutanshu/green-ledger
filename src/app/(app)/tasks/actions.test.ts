import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { adminPrisma as rawPrisma } from '@/lib/db/admin-client';

let orgId: string;
let sessionUserId: string;
let superAdminUserId: string;
let readOnlyUserId: string;
let taskId: string;
let originalStatus: string;

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === 'gl_org') return { value: orgId };
      if (name === 'gl_user') return { value: sessionUserId };
      return undefined;
    },
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const { setTaskStatus } = await import('./actions');

beforeAll(async () => {
  const org = await rawPrisma.organization.findFirstOrThrow({ where: { legalName: 'Meridian Industries (Demo)' } });
  orgId = org.id;

  superAdminUserId = (await rawPrisma.membership.findFirstOrThrow({ where: { organizationId: orgId, role: 'SUPER_ADMIN' } })).userId;
  readOnlyUserId = (await rawPrisma.membership.findFirstOrThrow({ where: { organizationId: orgId, role: 'READ_ONLY' } })).userId;
  sessionUserId = superAdminUserId;

  const task = await rawPrisma.task.findFirstOrThrow({ where: { organizationId: orgId } });
  taskId = task.id;
  originalStatus = task.status;
});

afterAll(async () => {
  await rawPrisma.task.update({ where: { id: taskId }, data: { status: originalStatus as never } });
  await rawPrisma.$disconnect();
});

describe('setTaskStatus', () => {
  it('is a no-op for a task id that does not exist (fail check)', async () => {
    await expect(setTaskStatus('00000000-0000-0000-0000-000000000000', 'DONE')).resolves.not.toThrow();
  });

  it('is a no-op for a role without manage_tasks (READ_ONLY)', async () => {
    sessionUserId = readOnlyUserId;
    try {
      await setTaskStatus(taskId, 'DONE');
      expect((await rawPrisma.task.findUniqueOrThrow({ where: { id: taskId } })).status).toBe(originalStatus);
    } finally {
      sessionUserId = superAdminUserId;
    }
  });

  it('marks a real task done, then reopens it — round trip actually persists', async () => {
    await setTaskStatus(taskId, 'DONE');
    expect((await rawPrisma.task.findUniqueOrThrow({ where: { id: taskId } })).status).toBe('DONE');

    await setTaskStatus(taskId, 'OPEN');
    expect((await rawPrisma.task.findUniqueOrThrow({ where: { id: taskId } })).status).toBe('OPEN');
  });
});
