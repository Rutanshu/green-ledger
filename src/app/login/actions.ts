"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { findDemoOrg } from "@/lib/demo-org";
import { setSession, clearSession } from "@/lib/session";
import { rawPrisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import type { Role } from "@/lib/auth/permissions";

const SignInInput = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter a password."),
});

export type SignInState = { error: string } | null;

export async function attemptSignIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = SignInInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { email, password } = parsed.data;

  const user = await rawPrisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { error: "Incorrect email or password." };
  }

  const membership = user.memberships[0];
  if (!membership) {
    return { error: "This account has no organisation membership." };
  }

  await setSession({ orgId: membership.organizationId, userId: user.id });
  await recordAudit(rawPrisma, {
    organizationId: membership.organizationId,
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
    actorUserId: user.id,
    after: { role: membership.role },
  });

  redirect("/");
}

/** One-click login as a seeded role account — still real auth (a real user + Membership), just skipping the password prompt for demo speed. */
export async function quickLogin(role: Role) {
  const org = await findDemoOrg();
  if (!org) redirect("/login?error=" + encodeURIComponent("No demo organisation found — run npm run db:seed."));

  const membership = await rawPrisma.membership.findFirst({
    where: { organizationId: org.id, role },
    include: { user: true },
  });
  if (!membership) {
    redirect("/login?error=" + encodeURIComponent(`No ${role} account found — run npm run db:seed.`));
  }

  await setSession({ orgId: org.id, userId: membership.user.id });
  await recordAudit(rawPrisma, {
    organizationId: org.id,
    action: "LOGIN",
    entityType: "User",
    entityId: membership.user.id,
    actorUserId: membership.user.id,
    after: { role, via: "quick-login" },
  });

  redirect("/");
}

export async function signOut() {
  await clearSession();
  redirect("/login");
}
