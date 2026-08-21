import { describe, it, expect } from 'vitest';
import { projectAnswer } from './index';

const periodStart = new Date('2026-01-01');
const periodEnd = new Date('2026-12-31');

describe('projectAnswer', () => {
  it('maps an answer + binding into an activity record shape', () => {
    const result = projectAnswer({
      answer: { valueNumeric: '14200', unit: 'L', dataQuality: 'MEASURED' },
      binding: { scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED', fuelOrMaterialCode: 'diesel' },
      periodStart,
      periodEnd,
    });

    expect(result).toEqual({
      scope: 'SCOPE_1',
      scope3Category: null,
      activityType: 'STATIONARY_COMBUSTION',
      method: 'FUEL_BASED',
      quantity: '14200',
      unit: 'L',
      activityStart: periodStart,
      activityEnd: periodEnd,
      fuelOrMaterialCode: 'diesel',
      dataQuality: 'MEASURED',
    });
  });

  it('does NOT apply the binding multiplier — quantity stays exactly what was reported', () => {
    // multiplier isn't even part of BindingForProjection's type, but this
    // guards the intent: a caller passing a scaled value would be a bug.
    const result = projectAnswer({
      answer: { valueNumeric: '100', unit: 'KWH', dataQuality: 'ESTIMATED' },
      binding: { scope: 'SCOPE_2', activityType: 'PURCHASED_ELECTRICITY', method: 'AVERAGE_DATA', fuelOrMaterialCode: 'grid_electricity' },
      periodStart,
      periodEnd,
    });
    expect(result.quantity).toBe('100');
  });

  it('carries scope3Category through when present', () => {
    const result = projectAnswer({
      answer: { valueNumeric: '5', unit: 'TONNE', dataQuality: 'MEASURED' },
      binding: {
        scope: 'SCOPE_3',
        scope3Category: 5,
        activityType: 'WASTE',
        method: 'WASTE_TYPE_SPECIFIC',
        fuelOrMaterialCode: 'waste_landfill_mixed',
      },
      periodStart,
      periodEnd,
    });
    expect(result.scope3Category).toBe(5);
  });
});
