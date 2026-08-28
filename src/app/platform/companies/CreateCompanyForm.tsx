"use client";

import { useActionState } from "react";
import { createCompany } from "./actions";

export function CreateCompanyForm() {
  const [state, formAction, pending] = useActionState(createCompany, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[13px] font-semibold text-white">New company</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          name="legalName"
          placeholder="Legal name"
          required
          className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-[#6b756f] focus:border-[#4fae8c]"
        />
        <input
          name="adminName"
          placeholder="First admin's name"
          required
          className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-[#6b756f] focus:border-[#4fae8c]"
        />
        <input
          name="adminEmail"
          type="email"
          placeholder="First admin's email"
          required
          className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-[#6b756f] focus:border-[#4fae8c]"
        />
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-[#4fae8c] px-4 py-2 text-[13px] font-semibold text-[#0a0c0b] disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create company"}
        </button>
        {state?.ok && (
          <span className="font-mono text-[12px] text-[#6ecda8]">
            Created. {state.password ? `Sign-in password: ${state.password}` : "Existing user added as Data Manager."}
          </span>
        )}
        {state && !state.ok && <span className="text-[12.5px] text-amber-300">{state.error}</span>}
      </div>
    </form>
  );
}
