import { describe, expect, it } from 'vitest';
import { calculatePcafFinancedEmissions, PcafInputSchema, PcafZeroDenominatorError, PCAF_CALC_ENGINE_VERSION } from './pcaf';

describe('calculatePcafFinancedEmissions', () => {
  it('listed equity/corporate bonds: attribution = outstanding / EVIC', () => {
    const input = PcafInputSchema.parse({
      assetClass: 'LISTED_EQUITY_CORPORATE_BONDS',
      outstandingAmount: '1000000',
      evic: '10000000',
      investeeEmissionsKgCo2e: '500000',
    });
    const r = calculatePcafFinancedEmissions(input);
    expect(r.attributionFactor.toString()).toBe('0.1');
    expect(r.financedEmissionsKgCo2e.toString()).toBe('50000');
    expect(r.calcEngineVersion).toBe(PCAF_CALC_ENGINE_VERSION);
  });

  it('business loans: attribution = outstanding / (total equity + total debt)', () => {
    const input = PcafInputSchema.parse({
      assetClass: 'BUSINESS_LOANS',
      outstandingAmount: '2000000',
      totalEquity: '5000000',
      totalDebt: '5000000',
      investeeEmissionsKgCo2e: '1000000',
    });
    const r = calculatePcafFinancedEmissions(input);
    expect(r.attributionFactor.toString()).toBe('0.2');
    expect(r.financedEmissionsKgCo2e.toString()).toBe('200000');
  });

  it('throws PcafZeroDenominatorError rather than dividing by zero', () => {
    const input = PcafInputSchema.parse({
      assetClass: 'LISTED_EQUITY_CORPORATE_BONDS',
      outstandingAmount: '1000',
      evic: '0',
      investeeEmissionsKgCo2e: '500',
    });
    expect(() => calculatePcafFinancedEmissions(input)).toThrow(PcafZeroDenominatorError);
  });

  it('Zod schema rejects a negative outstanding amount', () => {
    const parsed = PcafInputSchema.safeParse({
      assetClass: 'LISTED_EQUITY_CORPORATE_BONDS',
      outstandingAmount: '-100',
      evic: '10000',
      investeeEmissionsKgCo2e: '500',
    });
    expect(parsed.success).toBe(false);
  });

  it('Zod schema rejects LISTED_EQUITY_CORPORATE_BONDS without evic', () => {
    const parsed = PcafInputSchema.safeParse({
      assetClass: 'LISTED_EQUITY_CORPORATE_BONDS',
      outstandingAmount: '100',
      investeeEmissionsKgCo2e: '500',
    });
    expect(parsed.success).toBe(false);
  });

  it('same input always reproduces the same result (superseded-input reproducibility)', () => {
    const input = PcafInputSchema.parse({
      assetClass: 'BUSINESS_LOANS',
      outstandingAmount: '750000',
      totalEquity: '3000000',
      totalDebt: '2000000',
      investeeEmissionsKgCo2e: '800000',
    });
    const a = calculatePcafFinancedEmissions(input);
    const b = calculatePcafFinancedEmissions(input);
    expect(a.financedEmissionsKgCo2e.toString()).toBe(b.financedEmissionsKgCo2e.toString());
  });
});
