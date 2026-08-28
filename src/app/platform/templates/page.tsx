import { rawPrisma } from "@/lib/db/client";
import { withEachOrg } from "@/lib/db/tenant";
import { PlatformHeader, Table, Pill } from "../_ui";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const orgs = await rawPrisma.organization.findMany({ select: { id: true, legalName: true } });

  // questionnaire_templates has FORCE RLS — see withEachOrg's comment.
  const perOrg = await withEachOrg(
    orgs.map((o) => o.id),
    (tx) =>
      tx.questionnaireTemplate.findMany({
        include: { _count: { select: { sections: true, assignments: true } } },
        orderBy: { publishedAt: "desc" },
      }),
  );
  const orgNameById = new Map(orgs.map((o) => [o.id, o.legalName]));
  const templates = perOrg.flat();

  return (
    <>
      <PlatformHeader
        title="Templates"
        body="Every questionnaire template across every company. A shared platform-wide template library isn't built yet — this is visibility, not authoring."
      />
      <Table head={["Template", "Company", "Status", "Sections", "In use"]}>
        {templates.map((t) => (
          <tr key={t.id} className="border-b border-white/10 text-[#c7cbc4] last:border-0">
            <td className="px-4 py-2.5 font-medium text-white">
              {t.name} <span className="font-mono text-[11px] text-[#7a837e]">v{t.version}</span>
            </td>
            <td className="px-4 py-2.5">{orgNameById.get(t.organizationId) ?? "—"}</td>
            <td className="px-4 py-2.5">
              <Pill tone={t.status === "PUBLISHED" ? "good" : "neutral"}>{t.status.toLowerCase()}</Pill>
            </td>
            <td className="px-4 py-2.5">{t._count.sections}</td>
            <td className="px-4 py-2.5">{t._count.assignments} facilities</td>
          </tr>
        ))}
      </Table>
      {templates.length === 0 && <p className="mt-4 text-[13px] text-[#9aa39d]">No templates published anywhere yet.</p>}
    </>
  );
}
