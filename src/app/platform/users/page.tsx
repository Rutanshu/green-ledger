import { rawPrisma } from "@/lib/db/client";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { PlatformHeader, Table, Pill } from "../_ui";

export const dynamic = "force-dynamic";

export default async function GlobalUsersPage() {
  const memberships = await rawPrisma.membership.findMany({
    include: { user: true, organization: true },
    orderBy: [{ organization: { legalName: "asc" } }, { createdAt: "asc" }],
  });

  return (
    <>
      <PlatformHeader title="Global Users" body="Every membership across every company — a user can belong to more than one." />

      <Table head={["Person", "Company", "Role", "Member since"]}>
        {memberships.map((m) => (
          <tr key={m.id} className="border-b border-white/10 text-[#c7cbc4] last:border-0">
            <td className="px-4 py-2.5">
              <div className="font-medium text-white">{m.user.name ?? "—"}</div>
              <div className="font-mono text-[11.5px] text-[#7a837e]">{m.user.email}</div>
            </td>
            <td className="px-4 py-2.5">{m.organization.legalName}</td>
            <td className="px-4 py-2.5">
              <Pill tone={m.role === "SUPER_ADMIN" ? "good" : "neutral"}>{ROLE_LABEL[m.role]}</Pill>
            </td>
            <td className="px-4 py-2.5 font-mono text-[11.5px]">{m.createdAt.toISOString().slice(0, 10)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
