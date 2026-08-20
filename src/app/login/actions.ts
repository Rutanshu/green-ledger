"use server";

import { redirect } from "next/navigation";
import { findDemoOrg } from "@/lib/demo-org";
import { setSessionOrgId, clearSession } from "@/lib/session";

export async function startDemo() {
  const org = await findDemoOrg();
  if (!org) {
    redirect("/login?error=" + encodeURIComponent("No demo organisation found — run npm run db:seed."));
  }
  await setSessionOrgId(org.id);
  redirect("/how-it-works");
}

export async function attemptSignIn(_prevState: unknown, formData: FormData) {
  const email = formData.get("email");
  return {
    error: `No account for "${email}" — real sign-in (Auth.js) isn't wired up yet. Use "Try the demo" instead.`,
  };
}

export async function signOut() {
  await clearSession();
  redirect("/login");
}
