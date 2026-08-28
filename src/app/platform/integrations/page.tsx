import { rawPrisma } from "@/lib/db/client";
import { withEachOrg } from "@/lib/db/tenant";
import { PlatformHeader, Table, Pill } from "../_ui";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const orgs = await rawPrisma.organization.findMany({ select: { id: true, legalName: true } });
  const orgNameById = new Map(orgs.map((o) => [o.id, o.legalName]));

  // import_batches has FORCE RLS — see withEachOrg's comment.
  const perOrg = await withEachOrg(
    orgs.map((o) => o.id),
    (tx) => tx.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  );
  const batches = perOrg.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 50);

  return (
    <>
      <PlatformHeader title="Integrations" body="CSV imports across every company — the last 50 batches." />
      <Table head={["File", "Company", "Rows", "Status", "When"]}>
        {batches.map((b) => (
          <tr key={b.id} className="border-b border-white/10 text-[#c7cbc4] last:border-0">
            <td className="px-4 py-2.5 font-mono text-[12px] text-white">{b.filename}</td>
            <td className="px-4 py-2.5">{orgNameById.get(b.organizationId) ?? "—"}</td>
            <td className="px-4 py-2.5">
              {b.rowsAccepted}/{b.rowCount} accepted{b.rowsRejected > 0 ? `, ${b.rowsRejected} rejected` : ""}
            </td>
            <td className="px-4 py-2.5">
              <Pill tone={b.status === "COMMITTED" ? "good" : b.status === "FAILED" ? "warn" : "neutral"}>{b.status.toLowerCase()}</Pill>
            </td>
            <td className="px-4 py-2.5 font-mono text-[11.5px] text-[#9aa39d]">{b.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
          </tr>
        ))}
      </Table>
      {batches.length === 0 && <p className="mt-4 text-[13px] text-[#9aa39d]">No imports run anywhere yet.</p>}
    </>
  );
}
