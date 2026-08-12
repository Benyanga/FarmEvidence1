import { downloadTrialReport } from './pdf';

function makeMinimalFixture() {
  const trial = { crop: 'Bean', design: 'RCBD', numTreatments: 2, numReplicates: 4, plotSizeM2: 12, computed: { extrapolationFactor: 833.33, dfError: 6, tCritical: 2.447 } };
  const treatments = [{ _id: 'ca1', code: 'CA' }, { _id: 'cf1', code: 'CF' }];
  const plots = [];
  for (let i = 0; i < 4; i += 1) {
    plots.push({ treatmentId: 'ca1', replicateNumber: i + 1, yieldKg: 16, grossRevenueRwf: 19200, cSDTotal: 4200, cSITotal: 3000, totalProductionCost: 7200, netBenefit: 12000 });
    plots.push({ treatmentId: 'cf1', replicateNumber: i + 1, yieldKg: 14, grossRevenueRwf: 16800, cSDTotal: 7150, cSITotal: 3000, totalProductionCost: 10150, netBenefit: 6650 });
  }
  const stat = (mean) => ({ n: 4, mean, sd: 1, se: 0.5, ci95: { lower: mean - 2, upper: mean + 2 }, cv: 5 });
  const cbaSummary = { summary: {
    CA: { avgGrossRevenuePerPlot: 19200, avgTotalProductionCost: 7200, netBenefit: 12000, avgCSD: 4200, avgCSI: 3000, adjustedGrossMargin: 15000, bcr: 2.6, roi: 160, avgYieldPerPlot: 16, costPerKg: 450 },
    CF: { avgGrossRevenuePerPlot: 16800, avgTotalProductionCost: 10150, netBenefit: 6650, avgCSD: 7150, avgCSI: 3000, adjustedGrossMargin: 9650, bcr: 1.65, roi: 65, avgYieldPerPlot: 14, costPerKg: 725 }
  } };
  const anova = { yield: { canCompute: true, treatment: { ss: 1, df: 1, ms: 1, f: 1, p: 0.5, significant: false }, error: { ss: 1, df: 6, ms: 1 }, total: { ss: 2, df: 7 }, cv: 5, lsd: 2, treatmentMeans: { CA: 16, CF: 14 } } };
  const analysis = { config: trial.computed, plots, descriptiveStats: { yield: { CA: stat(16), CF: stat(14) } }, cbaSummary, costStructure: {}, anova, tTest: {}, rcbdBlockAnalysis: null, riskStability: {}, breakEven: { perTreatment: {} }, sensitivity: null };
  return { trial, treatments, analysis };
}

describe('generated PDF actually embeds PT Serif, not Roboto', () => {
  it('base font resources reference PT Serif, and Roboto is absent', async () => {
    const base64 = await downloadTrialReport(makeMinimalFixture());
    const buf = Buffer.from(base64, 'base64');
    const text = buf.toString('latin1');
    expect(text).toMatch(/PT ?Serif/i);
    expect(text).not.toMatch(/Roboto/);
  });
});
