import { rawPrisma } from "@/lib/db/client";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { getImpersonator } from "@/lib/session";
import { beginImpersonation } from "../../(app)/_shells/impersonationActions";
import { PlatformHeader, Table, Pill } from "../_ui";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const impersonator = await getImpersonator();
  const memberships = await rawPrisma.membership.findMany({
    include: { user: true, organization: true },
    orderBy: [{ organization: { legalName: "asc" } }],
  });

  return (
    <>
      <PlatformHeader
        title="Support"
        body="Step into exactly what a person sees, to help them — every action while impersonating is logged under both identities."
      />

      {impersonator && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-[13px] text-amber-200">
          Already impersonating someone — use the banner at the top of the page to stop before starting another.
        </div>
      )}

      <Table head={["Person", "Company", "Role", ""]}>
        {memberships.map((m) => (
          <tr key={m.id} className="border-b border-white/10 text-[#c7cbc4] last:border-0">
            <td className="px-4 py-2.5">
              <div className="font-medium text-white">{m.user.name ?? "—"}</div>
              <div className="font-mono text-[11.5px] text-[#7a837e]">{m.user.email}</div>
            </td>
            <td className="px-4 py-2.5">{m.organization.legalName}</td>
            <td className="px-4 py-2.5">
              <Pill>{ROLE_LABEL[m.role]}</Pill>
            </td>
            <td className="px-4 py-2.5 text-right">
              <form action={beginImpersonation.bind(null, m.id)}>
                <button
                  type="submit"
                  disabled={!!impersonator}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-[#e4e6e2] hover:bg-white/10 disabled:opacity-40"
                >
                  View as
                </button>
              </form>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
