import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rawPrisma } from '@/lib/db/client';

let orgId: string;
let taskId: string;
let originalStatus: string;

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'gl_org' ? { value: orgId } : undefined) }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const { setTaskStatus } = await import('./actions');

beforeAll(async () => {
  const org = await rawPrisma.organization.findFirstOrThrow({ where: { legalName: 'Meridian Industries (Demo)' } });
  orgId = org.id;
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

  it('marks a real task done, then reopens it — round trip actually persists', async () => {
    await setTaskStatus(taskId, 'DONE');
    expect((await rawPrisma.task.findUniqueOrThrow({ where: { id: taskId } })).status).toBe('DONE');

    await setTaskStatus(taskId, 'OPEN');
    expect((await rawPrisma.task.findUniqueOrThrow({ where: { id: taskId } })).status).toBe('OPEN');
  });
});
