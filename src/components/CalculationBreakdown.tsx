/**
 * Spec §6, "How was this calculated?" — a read-only display of fields an
 * EmissionRecord already stores (CLAUDE.md rule 2). No arithmetic happens
 * here; every number is formatted, not computed.
 */
import { labelText } from "./Label";
import type { LabelOverride } from "@/lib/labels";

export interface EmissionRecordSummary {
  quantityNormalised: string;
  unitNormalised: string;
  factorValue: string;
  factorUnitNumerator: string;
  factorUnitDenominator: string;
  factorSource: string;
  factorVersion: string;
  gwpValue: string;
  gwpSet: string;
  emissionsKgCo2e: string;
  calcEngineVersion: string;
}

export function CalculationBreakdown({
  record,
  labelOverrides = [],
}: {
  record: EmissionRecordSummary;
  labelOverrides?: readonly LabelOverride[];
}) {
  const unit = (code: string) => labelText("UNIT", code, labelOverrides);

  return (
    <div className="rounded-[11px] border border-border bg-surface p-4 text-[13.5px]">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">How this was calculated</div>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[13px]">
        <span>{record.quantityNormalised}</span>
        <span className="text-ink2">{unit(record.unitNormalised)}</span>
        <span className="text-muted">×</span>
        <span>{record.factorValue}</span>
        <span className="text-ink2">
          {unit(record.factorUnitNumerator)} per {unit(record.factorUnitDenominator)}
        </span>
        <span className="text-muted">×</span>
        <span>{record.gwpValue}</span>
        <span className="text-ink2">GWP</span>
        <span className="text-muted">=</span>
        <span className="font-semibold text-ink">{Number(record.emissionsKgCo2e).toLocaleString()} kg CO₂e</span>
      </div>
      <div className="mt-2.5 text-[12px] text-ink2">
        Factor: {record.factorSource} · version {record.factorVersion} · warming-potential standard {record.gwpSet}
      </div>
    </div>
  );
}
