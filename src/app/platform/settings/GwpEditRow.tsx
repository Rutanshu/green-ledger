"use client";

import { useActionState } from "react";
import { updateGwpValue } from "./actions";

export function GwpEditRow({ id, name, gas, gwp100, isDefault }: { id: string; name: string; gas: string; gwp100: string; isDefault: boolean }) {
  const [state, formAction, pending] = useActionState(updateGwpValue, null);

  return (
    <tr className="border-b border-white/10 text-[#c7cbc4] last:border-0">
      <td className="px-4 py-2.5 font-medium text-white">{name}</td>
      <td className="px-4 py-2.5 font-mono text-[12px]">{gas}</td>
      <td className="px-4 py-2.5">{isDefault ? "Default" : ""}</td>
      <td className="px-4 py-2.5">
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input
            name="gwp100"
            type="number"
            step="any"
            defaultValue={gwp100}
            className="w-24 rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono text-[12px] text-white outline-none focus:border-[#4fae8c]"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11.5px] font-medium hover:bg-white/10 disabled:opacity-40"
          >
            {pending ? "…" : "Save"}
          </button>
          {state?.ok && <span className="text-[11px] text-[#6ecda8]">Saved</span>}
          {state && !state.ok && <span className="text-[11px] text-amber-300">{state.error}</span>}
        </form>
      </td>
    </tr>
  );
}
