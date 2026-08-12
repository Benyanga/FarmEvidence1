import { buildTrialReportContent } from './trialReportSections';

/**
 * Synthetic fixture shaped like a real 4-replicate CA-vs-CF RCBD bean trial
 * (the spec's own capstone-report scenario) — internally plausible, not a
 * byte-for-byte reproduction of any real trial's numbers.
 */
function makeFixture(overrides = {}) {
  const trial = {
    crop: 'Bean',
    variety: 'RWV 1129',
    design: 'RCBD',
    numTreatments: 2,
    numReplicates: 4,
    plotSizeM2: 12,
    site: 'Tuzamurane',
    district: 'Huye',
    computed: { extrapolationFactor: 833.33, dfError: 6, tCritical: 2.447 },
    ...overrides.trial
  };
  const setup = { name: 'Tuzamurane Youth Cooperative', ...overrides.setup };
  const season = { seasonLabel: 'Season B 2026', ...overrides.season };
  const treatments = overrides.treatments || [
    { _id: 'ca1', code: 'CA' },
    { _id: 'cf1', code: 'CF' }
  ];

  const caYields = [17.2, 16.8, 15.5, 15.6];
  const cfYields = [15.1, 14.9, 13.8, 14.4];
  const caRevenue = caYields.map((y) => y * 1200);
  const cfRevenue = cfYields.map((y) => y * 1200);
  const caCSD = [4200, 4300, 4100, 4250];
  const cfCSD = [7100, 7200, 7050, 7150];
  const caCSI = [3000, 3000, 3000, 3000];
  const cfCSI = [3000, 3000, 3000, 3000];

  const plots = [];
  for (let i = 0; i < 4; i += 1) {
    const totalCA = caCSD[i] + caCSI[i];
    const totalCF = cfCSD[i] + cfCSI[i];
    plots.push({
      treatmentId: 'ca1',
      replicateNumber: i + 1,
      yieldKg: caYields[i],
      grossRevenueRwf: caRevenue[i],
      cSDTotal: caCSD[i],
      cSITotal: caCSI[i],
      totalProductionCost: totalCA,
      netBenefit: caRevenue[i] - totalCA,
      subtotalLabourTimeMin: 90 - i,
      subtotalLabourCosts: 4200 + i * 10
    });
    plots.push({
      treatmentId: 'cf1',
      replicateNumber: i + 1,
      yieldKg: cfYields[i],
      grossRevenueRwf: cfRevenue[i],
      cSDTotal: cfCSD[i],
      cSITotal: cfCSI[i],
      totalProductionCost: totalCF,
      netBenefit: cfRevenue[i] - totalCF,
      subtotalLabourTimeMin: 150 - i,
      subtotalLabourCosts: 7100 + i * 10
    });
  }

  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const sd = (arr) => {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
  };

  const caNetBenefit = plots.filter((p) => p.treatmentId === 'ca1').map((p) => p.netBenefit);
  const cfNetBenefit = plots.filter((p) => p.treatmentId === 'cf1').map((p) => p.netBenefit);
  const caYieldMean = mean(caYields);
  const cfYieldMean = mean(cfYields);
  const caRevMean = mean(caRevenue);
  const cfRevMean = mean(cfRevenue);
  const caCostMean = mean(plots.filter((p) => p.treatmentId === 'ca1').map((p) => p.totalProductionCost));
  const cfCostMean = mean(plots.filter((p) => p.treatmentId === 'cf1').map((p) => p.totalProductionCost));
  const caNetMean = mean(caNetBenefit);
  const cfNetMean = mean(cfNetBenefit);
  const caCSDMean = mean(caCSD);
  const cfCSDMean = mean(cfCSD);
  const caCSIMean = mean(caCSI);
  const cfCSIMean = mean(cfCSI);

  const cbaSummary = {
    summary: {
      CA: {
        avgGrossRevenuePerPlot: caRevMean,
        avgGrossRevenuePerHa: caRevMean * trial.computed.extrapolationFactor,
        avgTotalProductionCost: caCostMean,
        netBenefit: caNetMean,
        avgCSD: caCSDMean,
        avgCSI: caCSIMean,
        adjustedGrossMargin: caRevMean - caCSDMean,
        bcr: caRevMean / caCostMean,
        roi: (caNetMean / caCostMean) * 100,
        avgYieldPerPlot: caYieldMean,
        avgYieldPerHa: caYieldMean * trial.computed.extrapolationFactor,
        costPerKg: caCostMean / caYieldMean
      },
      CF: {
        avgGrossRevenuePerPlot: cfRevMean,
        avgGrossRevenuePerHa: cfRevMean * trial.computed.extrapolationFactor,
        avgTotalProductionCost: cfCostMean,
        netBenefit: cfNetMean,
        avgCSD: cfCSDMean,
        avgCSI: cfCSIMean,
        adjustedGrossMargin: cfRevMean - cfCSDMean,
        bcr: cfRevMean / cfCostMean,
        roi: (cfNetMean / cfCostMean) * 100,
        avgYieldPerPlot: cfYieldMean,
        avgYieldPerHa: cfYieldMean * trial.computed.extrapolationFactor,
        costPerKg: cfCostMean / cfYieldMean
      }
    },
    comparisons: []
  };

  const costStructure = {
    CA: {
      total: caCSDMean + caCSIMean,
      csdCsi: { C_SD: { amount: caCSDMean, pctOfTotal: 60 }, C_SI: { amount: caCSIMean, pctOfTotal: 40 } },
      components: {
        Mulch: { amount: 2200, pctOfTotal: 30, costType: 'C_SD' },
        'Weeding labour': { amount: 2050, pctOfTotal: 28, costType: 'C_SD' },
        Seed: { amount: 3000, pctOfTotal: 42, costType: 'C_SI' }
      }
    },
    CF: {
      total: cfCSDMean + cfCSIMean,
      csdCsi: { C_SD: { amount: cfCSDMean, pctOfTotal: 70 }, C_SI: { amount: cfCSIMean, pctOfTotal: 30 } },
      components: {
        'Weeding labour': { amount: 5100, pctOfTotal: 50, costType: 'C_SD' },
        Herbicide: { amount: 2050, pctOfTotal: 20, costType: 'C_SD' },
        Seed: { amount: 3000, pctOfTotal: 30, costType: 'C_SI' }
      }
    }
  };

  const descriptiveStats = {
    yield: {
      CA: { n: 4, mean: caYieldMean, sd: sd(caYields), se: sd(caYields) / 2, ci95: { lower: caYieldMean - 3, upper: caYieldMean + 3 }, cv: (sd(caYields) / caYieldMean) * 100 },
      CF: { n: 4, mean: cfYieldMean, sd: sd(cfYields), se: sd(cfYields) / 2, ci95: { lower: cfYieldMean - 3, upper: cfYieldMean + 3 }, cv: (sd(cfYields) / cfYieldMean) * 100 }
    },
    grossRevenue: {
      CA: { n: 4, mean: caRevMean, sd: sd(caRevenue), se: sd(caRevenue) / 2, ci95: { lower: caRevMean - 1000, upper: caRevMean + 1000 }, cv: 5 },
      CF: { n: 4, mean: cfRevMean, sd: sd(cfRevenue), se: sd(cfRevenue) / 2, ci95: { lower: cfRevMean - 1000, upper: cfRevMean + 1000 }, cv: 5 }
    },
    totalProductionCost: {
      CA: { n: 4, mean: caCostMean, sd: 100, se: 50, ci95: { lower: caCostMean - 200, upper: caCostMean + 200 }, cv: 3 },
      CF: { n: 4, mean: cfCostMean, sd: 100, se: 50, ci95: { lower: cfCostMean - 200, upper: cfCostMean + 200 }, cv: 3 }
    },
    netBenefit: {
      CA: { n: 4, mean: caNetMean, sd: sd(caNetBenefit), se: sd(caNetBenefit) / 2, ci95: { lower: -1.9, upper: 5.35 }, cv: 8 },
      CF: { n: 4, mean: cfNetMean, sd: sd(cfNetBenefit), se: sd(cfNetBenefit) / 2, ci95: { lower: -1.9, upper: 5.35 }, cv: 8 }
    },
    cSD: { CA: { n: 4, mean: caCSDMean, sd: 80, se: 40, ci95: { lower: caCSDMean - 100, upper: caCSDMean + 100 }, cv: 2 }, CF: { n: 4, mean: cfCSDMean, sd: 80, se: 40, ci95: { lower: cfCSDMean - 100, upper: cfCSDMean + 100 }, cv: 2 } },
    cSI: { CA: { n: 4, mean: caCSIMean, sd: 0, se: 0, ci95: { lower: caCSIMean, upper: caCSIMean }, cv: 0 }, CF: { n: 4, mean: cfCSIMean, sd: 0, se: 0, ci95: { lower: cfCSIMean, upper: cfCSIMean }, cv: 0 } },
    labourTime: { CA: { n: 4, mean: 88.5, sd: 2, se: 1, ci95: { lower: 85, upper: 92 }, cv: 2 }, CF: { n: 4, mean: 148.5, sd: 2, se: 1, ci95: { lower: 145, upper: 152 }, cv: 1 } },
    labourCost: { CA: { n: 4, mean: 4215, sd: 12, se: 6, ci95: { lower: 4190, upper: 4240 }, cv: 0.3 }, CF: { n: 4, mean: 7115, sd: 12, se: 6, ci95: { lower: 7090, upper: 7140 }, cv: 0.2 } }
  };

  const anova = {
    yield: { canCompute: true, treatment: { ss: 12.3, df: 1, ms: 12.3, f: 6.1, p: 0.048, significant: true }, error: { ss: 10, df: 6, ms: 1.67 }, total: { ss: 22.3, df: 7 }, cv: 6.4, lsd: 1.9, treatmentMeans: { CA: caYieldMean, CF: cfYieldMean } },
    grossRevenue: { canCompute: true, treatment: { ss: 500000, df: 1, ms: 500000, f: 3.1, p: 0.129, significant: false }, error: { ss: 900000, df: 6, ms: 150000 }, total: { ss: 1400000, df: 7 }, cv: 8.1, lsd: 900, treatmentMeans: { CA: caRevMean, CF: cfRevMean } },
    totalProductionCost: { canCompute: true, treatment: { ss: 300000, df: 1, ms: 300000, f: 45.2, p: 0.0005, significant: true }, error: { ss: 40000, df: 6, ms: 6666 }, total: { ss: 340000, df: 7 }, cv: 3.2, lsd: 200, treatmentMeans: { CA: caCostMean, CF: cfCostMean } },
    netBenefit: { canCompute: true, treatment: { ss: 200000, df: 1, ms: 200000, f: 2.8, p: 0.145, significant: false }, error: { ss: 420000, df: 6, ms: 70000 }, total: { ss: 620000, df: 7 }, cv: 9.5, lsd: 750, treatmentMeans: { CA: caNetMean, CF: cfNetMean } },
    cSD: { canCompute: false },
    cSI: { canCompute: false },
    labourTime: { canCompute: false },
    labourCost: { canCompute: false }
  };

  const tTest = {
    yield: { canCompute: true, tStat: 2.47, df: 6, pValue: 0.048, significant: true, ci95: { lower: 0.02, upper: 3.5 } },
    grossRevenue: { canCompute: true, tStat: 1.76, df: 6, pValue: 0.129, significant: false, ci95: { lower: -500, upper: 3500 } },
    totalProductionCost: { canCompute: true, tStat: 6.72, df: 6, pValue: 0.0005, significant: true, ci95: { lower: 2100, upper: 2900 } },
    netBenefit: { canCompute: true, tStat: 1.67, df: 6, pValue: 0.145, significant: false, ci95: { lower: -1.9, upper: 5.35 } }
  };

  const rcbdBlockAnalysis = {
    yield: {
      canCompute: true,
      grandMean: (caYieldMean + cfYieldMean) / 2,
      blockMeans: [16.15, 15.85, 14.65, 15.0],
      blockEffects: [
        { block: 1, effect: 0.5 },
        { block: 2, effect: 0.2 },
        { block: 3, effect: -1.0 },
        { block: 4, effect: -0.5 }
      ],
      treatmentMeans: { CA: caYieldMean, CF: cfYieldMean },
      block: { f: 1.2, p: 0.38, significant: false }
    }
  };

  const riskStability = {
    yield: {
      perTreatment: {
        CA: { sd: sd(caYields), cv: (sd(caYields) / caYieldMean) * 100, range: Math.max(...caYields) - Math.min(...caYields) },
        CF: { sd: sd(cfYields), cv: (sd(cfYields) / cfYieldMean) * 100, range: Math.max(...cfYields) - Math.min(...cfYields) }
      }
    }
  };

  const breakEven = {
    perTreatment: {
      CA: { breakEvenYieldPlot: caCostMean / 1200, yieldMarginOfSafety: ((caYieldMean - caCostMean / 1200) / caYieldMean) * 100 },
      CF: { breakEvenYieldPlot: cfCostMean / 1200, yieldMarginOfSafety: ((cfYieldMean - cfCostMean / 1200) / cfYieldMean) * 100 }
    }
  };

  const sensitivity = {
    scenarios: {
      pessimistic: { CA: { grossMargin: caNetMean * 0.6 }, CF: { grossMargin: cfNetMean * 0.6 } },
      expected: { CA: { grossMargin: caNetMean }, CF: { grossMargin: cfNetMean } },
      optimistic: { CA: { grossMargin: caNetMean * 1.4 }, CF: { grossMargin: cfNetMean * 1.4 } }
    },
    winnerMatrix: { pessimistic: 'CA', expected: 'CA', optimistic: 'CA' }
  };

  const analysis = {
    config: trial.computed,
    plots,
    descriptiveStats,
    cbaSummary,
    costStructure,
    anova,
    tTest,
    rcbdBlockAnalysis,
    riskStability,
    breakEven,
    sensitivity,
    ...overrides.analysis
  };

  return { trial, setup, season, seasonLabel: season.seasonLabel, treatments, analysis, partialBudget: overrides.partialBudget };
}

function findText(content, predicate) {
  return content.find((node) => typeof node?.text === 'string' && predicate(node.text));
}

function allText(content) {
  return content
    .map((node) => (typeof node?.text === 'string' ? node.text : Array.isArray(node?.text) ? node.text.join('') : ''))
    .join('\n');
}

describe('buildTrialReportContent', () => {
  it('renders every unconditional section for a complete RCBD trial', () => {
    const content = buildTrialReportContent(makeFixture());
    const text = allText(content);

    expect(findText(content, (t) => t.includes('Trial Summary'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Net Differential Summary'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('CBA Indicators'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Cost Structure'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Raw Data by Replicate'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Descriptive Statistics'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('ANOVA & Hypothesis Tests'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('RCBD Block Analysis'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Yield Stability & Sensitivity Analysis'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Results Discussion'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Limitations'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Appendix: Full Raw Plot Data'))).toBeTruthy();
    expect(text).not.toContain('literature');
    expect(text).not.toContain('benchmarks');
  });

  it('omits the Partial Budget section when no baseline/alternative comparison is supplied', () => {
    const content = buildTrialReportContent(makeFixture());
    expect(findText(content, (t) => t.includes('Partial Budget Analysis'))).toBeFalsy();
  });

  it('includes the Partial Budget section when a comparison is supplied', () => {
    const partialBudget = { benefitLines: [{ item: 'Additional yield revenue', amount: 3000 }], costLines: [{ item: 'Weeding labour cost', amount: 1200 }], additionalBenefits: 3000, additionalCosts: 1200, netChange: 1800, recommendation: 'Adopt CA: net gain of 1800/plot' };
    const content = buildTrialReportContent(makeFixture({ partialBudget }));
    expect(findText(content, (t) => t.includes('Partial Budget Analysis'))).toBeTruthy();
  });

  it('omits RCBD Block Analysis when the trial has fewer than 3 replicates', () => {
    const content = buildTrialReportContent(makeFixture({ trial: { numReplicates: 2 } }));
    expect(findText(content, (t) => t.includes('RCBD Block Analysis'))).toBeFalsy();
  });

  it('omits RCBD Block Analysis for a non-RCBD design', () => {
    const content = buildTrialReportContent(makeFixture({ trial: { design: 'CRD' } }));
    expect(findText(content, (t) => t.includes('RCBD Block Analysis'))).toBeFalsy();
  });

  it('flags Superior System per-row, independently for higher-is-better and lower-is-better indicators', () => {
    const content = buildTrialReportContent(makeFixture());
    const cbaTable = content.find((node) => node?.table && node.table.body.some((row) => row[0]?.text?.startsWith('Benefit-Cost Ratio')));
    expect(cbaTable).toBeTruthy();
    const rows = cbaTable.table.body.map((row) => row.map((cell) => cell.text));
    const bcrRow = rows.find((r) => r[0].startsWith('Benefit-Cost Ratio'));
    const costPerKgRow = rows.find((r) => r[0].startsWith('Cost of Production per kg'));
    // CA has the higher BCR (higher-is-better) and the lower cost-per-kg (lower-is-better) in this fixture.
    expect(bcrRow[5]).toBe('CA superior');
    expect(costPerKgRow[5]).toBe('CA superior');
  });

  it('formats negative differences with the minus glyph and percentages with an explicit sign', () => {
    const content = buildTrialReportContent(makeFixture());
    const text = allText(content) + JSON.stringify(content);
    expect(text).toMatch(/−\d/); // minus glyph appears somewhere (a CF-favoring row)
    expect(text).toMatch(/[+−]\d+(\.\d+)?%/); // signed percentage
  });

  it('generates the Net Differential chart with a caption naming the treatment means as reference lines', () => {
    const content = buildTrialReportContent(makeFixture());
    const svgNode = content.find((node) => typeof node?.svg === 'string' && node.svg.includes('stroke-dasharray="5,3"'));
    expect(svgNode).toBeTruthy();
    const caption = findText(content, (t) => t.startsWith('Figure') && t.includes('reference line'));
    expect(caption).toBeTruthy();
  });
});
