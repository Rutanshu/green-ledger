/**
 * An Answer is what a human typed; an ActivityRecord is the accounting
 * record. projectAnswer() maps one to the other. See CLAUDE.md rule 11 —
 * UI code must never write an ActivityRecord directly.
 *
 * PURE. No Prisma import, no fetch, no Date.now(). The multiplier from a
 * FactorBinding (e.g. "x12 for a monthly question") is deliberately NOT
 * applied here — the ActivityRecord.quantity must stay exactly what was
 * reported, traceable to the answer. The multiplier is a calc-time
 * transform, applied by lib/calc via CalcInput.multiplier.
 */
import type { UnitCode } from '../units';
import type { Scope, ActivityType, CalcMethod } from '../factors';

export type DataQuality = 'MEASURED' | 'CALCULATED' | 'ESTIMATED' | 'PROXY';

export interface AnswerForProjection {
  valueNumeric: string | number;
  unit: UnitCode;
  dataQuality: DataQuality;
}

export interface BindingForProjection {
  scope: Scope;
  scope3Category?: number | null;
  activityType: ActivityType;
  method: CalcMethod;
  fuelOrMaterialCode: string;
}

export interface ProjectedActivity {
  scope: Scope;
  scope3Category: number | null;
  activityType: ActivityType;
  method: CalcMethod;
  quantity: string;
  unit: UnitCode;
  activityStart: Date;
  activityEnd: Date;
  fuelOrMaterialCode: string;
  dataQuality: DataQuality;
}

export function projectAnswer(input: {
  answer: AnswerForProjection;
  binding: BindingForProjection;
  periodStart: Date;
  periodEnd: Date;
}): ProjectedActivity {
  const { answer, binding } = input;
  return {
    scope: binding.scope,
    scope3Category: binding.scope3Category ?? null,
    activityType: binding.activityType,
    method: binding.method,
    quantity: answer.valueNumeric.toString(),
    unit: answer.unit,
    activityStart: input.periodStart,
    activityEnd: input.periodEnd,
    fuelOrMaterialCode: binding.fuelOrMaterialCode,
    dataQuality: answer.dataQuality,
  };
}
