import { downloadTrialReport } from './pdf';

// Reuse the same fixture shape as trialReportSections.test.js, inlined here
// to avoid exporting test-only helpers from a production module.
function makeFixture() {
  const trial = {
    crop: 'Bean', variety: 'RWV 1129', design: 'RCBD', numTreatments: 2, numReplicates: 4, plotSizeM2: 12,
    site: 'Tuzamurane', district: 'Huye', computed: { extrapolationFactor: 833.33, dfError: 6, tCritical: 2.447 }
  };
  const setup = { name: 'Tuzamurane Youth Cooperative' };
  const season = { seasonLabel: 'Season B 2026' };
  const treatments = [{ _id: 'ca1', code: 'CA' }, { _id: 'cf1', code: 'CF' }];
  const caYields = [17.2, 16.8, 15.5, 15.6];
  const cfYields = [15.1, 14.9, 13.8, 14.4];
  const plots = [];
  for (let i = 0; i < 4; i += 1) {
    plots.push({ treatmentId: 'ca1', replicateNumber: i + 1, yieldKg: caYields[i], grossRevenueRwf: caYields[i] * 1200, cSDTotal: 4200, cSITotal: 3000, totalProductionCost: 7200, netBenefit: caYields[i] * 1200 - 7200, subtotalLabourTimeMin: 88, subtotalLabourCosts: 4200 });
    plots.push({ treatmentId: 'cf1', replicateNumber: i + 1, yieldKg: cfYields[i], grossRevenueRwf: cfYields[i] * 1200, cSDTotal: 7150, cSITotal: 3000, totalProductionCost: 10150, netBenefit: cfYields[i] * 1200 - 10150, subtotalLabourTimeMin: 148, subtotalLabourCosts: 7150 });
  }
  const cbaSummary = {
    summary: {
      CA: { avgGrossRevenuePerPlot: 18720, avgGrossRevenuePerHa: 15600000, avgTotalProductionCost: 7200, netBenefit: 11520, avgCSD: 4200, avgCSI: 3000, adjustedGrossMargin: 14520, bcr: 2.6, roi: 160, avgYieldPerPlot: 16.28, avgYieldPerHa: 13566, costPerKg: 442 },
      CF: { avgGrossRevenuePerPlot: 16920, avgGrossRevenuePerHa: 14100000, avgTotalProductionCost: 10150, netBenefit: 6770, avgCSD: 7150, avgCSI: 3000, adjustedGrossMargin: 9770, bcr: 1.67, roi: 66.7, avgYieldPerPlot: 14.55, avgYieldPerHa: 12125, costPerKg: 697 }
    }
  };
  const costStructure = {
    CA: { total: 7200, csdCsi: { C_SD: { amount: 4200 }, C_SI: { amount: 3000 } }, components: { Mulch: { amount: 2200, costType: 'C_SD' }, 'Weeding labour': { amount: 2000, costType: 'C_SD' }, Seed: { amount: 3000, costType: 'C_SI' } } },
    CF: { total: 10150, csdCsi: { C_SD: { amount: 7150 }, C_SI: { amount: 3000 } }, components: { 'Weeding labour': { amount: 5100, costType: 'C_SD' }, Herbicide: { amount: 2050, costType: 'C_SD' }, Seed: { amount: 3000, costType: 'C_SI' } } }
  };
  const stat = (mean) => ({ n: 4, mean, sd: 1, se: 0.5, ci95: { lower: mean - 2, upper: mean + 2 }, cv: 5 });
  const descriptiveStats = {
    yield: { CA: stat(16.28), CF: stat(14.55) },
    grossRevenue: { CA: stat(18720), CF: stat(16920) },
    totalProductionCost: { CA: stat(7200), CF: stat(10150) },
    netBenefit: { CA: stat(11520), CF: stat(6770) },
    cSD: { CA: stat(4200), CF: stat(7150) },
    cSI: { CA: stat(3000), CF: stat(3000) },
    labourTime: { CA: stat(88), CF: stat(148) },
    labourCost: { CA: stat(4200), CF: stat(7150) }
  };
  const anovaRow = (meanA, meanB, significant) => ({ canCompute: true, treatment: { ss: 10, df: 1, ms: 10, f: 5, p: significant ? 0.02 : 0.3, significant }, error: { ss: 20, df: 6, ms: 3.3 }, total: { ss: 30, df: 7 }, cv: 5, lsd: 2, treatmentMeans: { CA: meanA, CF: meanB } });
  const anova = {
    yield: anovaRow(16.28, 14.55, true),
    grossRevenue: anovaRow(18720, 16920, false),
    totalProductionCost: anovaRow(7200, 10150, true),
    netBenefit: anovaRow(11520, 6770, false),
    cSD: { canCompute: false }, cSI: { canCompute: false }, labourTime: { canCompute: false }, labourCost: { canCompute: false }
  };
  const tTest = {
    yield: { canCompute: true, tStat: 2.47, df: 6, pValue: 0.02, significant: true, ci95: { lower: 0.5, upper: 3 } },
    grossRevenue: { canCompute: true, tStat: 1.2, df: 6, pValue: 0.3, significant: false, ci95: { lower: -500, upper: 3000 } },
    totalProductionCost: { canCompute: true, tStat: 5, df: 6, pValue: 0.001, significant: true, ci95: { lower: 2000, upper: 3900 } },
    netBenefit: { canCompute: true, tStat: 1.5, df: 6, pValue: 0.18, significant: false, ci95: { lower: -1000, upper: 5000 } }
  };
  const rcbdBlockAnalysis = { yield: { canCompute: true, grandMean: 15.4, blockMeans: [16.15, 15.85, 14.65, 15.0], blockEffects: [{ block: 1, effect: 0.5 }, { block: 2, effect: 0.2 }, { block: 3, effect: -1.0 }, { block: 4, effect: -0.5 }], treatmentMeans: { CA: 16.28, CF: 14.55 }, block: { f: 1.2, p: 0.38, significant: false } } };
  const riskStability = { yield: { perTreatment: { CA: { sd: 0.8, cv: 4.9, range: 1.7 }, CF: { sd: 0.6, cv: 4.1, range: 1.3 } } } };
  const breakEven = { perTreatment: { CA: { breakEvenYieldPlot: 6, yieldMarginOfSafety: 60 }, CF: { breakEvenYieldPlot: 8.5, yieldMarginOfSafety: 40 } } };
  const sensitivity = { scenarios: { pessimistic: { CA: { grossMargin: 6900 }, CF: { grossMargin: 4000 } }, expected: { CA: { grossMargin: 11520 }, CF: { grossMargin: 6770 } }, optimistic: { CA: { grossMargin: 16100 }, CF: { grossMargin: 9500 } } }, winnerMatrix: { pessimistic: 'CA', expected: 'CA', optimistic: 'CA' } };

  const analysis = { config: trial.computed, plots, descriptiveStats, cbaSummary, costStructure, anova, tTest, rcbdBlockAnalysis, riskStability, breakEven, sensitivity };
  return { trial, setup, season, seasonLabel: season.seasonLabel, treatments, analysis };
}

describe('downloadTrialReport end-to-end', () => {
  it('renders the full Trial Mode report to a real PDF without throwing', async () => {
    const base64 = await downloadTrialReport(makeFixture());
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(5000);
  });
});
