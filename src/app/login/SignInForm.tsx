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
          className="w-full rounded-lg border border-border bg-white/40 px-3 py-2 text-sm outline-none backdrop-blur-sm transition focus:border-accent focus:bg-white/70 dark:bg-black/20 dark:focus:bg-black/40"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink2">Password</label>
        <input
          name="password"
          type="password"
          required
          placeholder="••••••••"
          className="w-full rounded-lg border border-border bg-white/40 px-3 py-2 text-sm outline-none backdrop-blur-sm transition focus:border-accent focus:bg-white/70 dark:bg-black/20 dark:focus:bg-black/40"
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
        className="rounded-lg border border-border bg-white/40 px-3 py-2 text-sm font-medium backdrop-blur-sm transition hover:bg-white/60 disabled:opacity-60 dark:bg-black/20 dark:hover:bg-black/40"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
