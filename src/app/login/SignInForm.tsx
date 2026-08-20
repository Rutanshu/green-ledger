"use client";

import { useActionState } from "react";
import { attemptSignIn } from "./actions";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(attemptSignIn, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink2">Email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="you@company.com"
          className="w-full rounded-md border border-border bg-plane px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink2">Password</label>
        <input
          name="password"
          type="password"
          required
          placeholder="••••••••"
          className="w-full rounded-md border border-border bg-plane px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-track disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
