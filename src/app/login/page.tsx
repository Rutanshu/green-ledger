import { startDemo } from "./actions";
import { SignInForm } from "./SignInForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-plane p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 text-[15px] font-semibold">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-accent text-xs font-bold text-white">
            G
          </span>
          Green Ledger
        </div>

        <div className="rounded-[11px] border border-border bg-surface p-5">
          <h1 className="text-base font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-ink2">For your own account. Not wired up yet — try the demo below.</p>
          <div className="mt-4">
            <SignInForm />
          </div>
        </div>

        <div className="my-4 flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form action={startDemo}>
          <button
            type="submit"
            className="w-full rounded-[11px] border border-border bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            Try the demo — no signup required
          </button>
        </form>
        <p className="mt-2 text-center text-xs text-muted">
          Drops you into a seeded organisation — 4 sites, real emission factors, a published questionnaire.
        </p>
      </div>
    </div>
  );
}
