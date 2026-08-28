import { NextRequest, NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";

interface FiguresSnapshot {
  totalKgCo2e: string;
  totalTonnes: string;
  byScope: Record<string, string>;
  byScope3Category: Record<string, string>;
  bySite: Array<{ siteId: string; siteName: string; kgCo2e: string }>;
  recordCount: number;
}

function toCsv(snapshot: FiguresSnapshot, generatedAt: string): string {
  const lines = [
    "Green Ledger emissions report",
    `Generated,${generatedAt}`,
    "",
    "Scope,Emissions (kg CO2e)",
    ...Object.entries(snapshot.byScope).map(([scope, kg]) => `${scope},${kg}`),
    "",
    "Facility,Emissions (kg CO2e)",
    ...snapshot.bySite.map((s) => `"${s.siteName.replace(/"/g, '""')}",${s.kgCo2e}`),
    "",
    `Total (kg CO2e),${snapshot.totalKgCo2e}`,
    `Total (tCO2e),${snapshot.totalTonnes}`,
  ];
  return lines.join("\n");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const membership = await getCurrentMembership();
  if (!membership) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!can(membership.role, "view")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";

  const db = orgScopedClient(membership.org.id);
  const report = await db.report.findFirst({ where: { id }, include: { period: true } });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const snapshot = report.figuresSnapshot as unknown as FiguresSnapshot;
  const filename = `green-ledger-${report.period.label.replace(/\s+/g, "-").toLowerCase()}-${report.id.slice(0, 8)}`;

  if (format === "csv") {
    return new NextResponse(toCsv(snapshot, report.generatedAt.toISOString()), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  return new NextResponse(
    JSON.stringify(
      {
        reportId: report.id,
        reportingPeriod: report.period.label,
        generatedAt: report.generatedAt,
        calcEngineVersion: report.calcEngineVersion,
        factorSetsUsed: report.factorSetsUsed,
        figures: snapshot,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    },
  );
}
