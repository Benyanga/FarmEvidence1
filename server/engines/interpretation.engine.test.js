/**
 * Unit tests for the interpretation engine, using the "testing with
 * capstone data" trial (Tuzamurane Youth Cooperative, RCBD, CA vs CF,
 * n=4 replicates/treatment) as the fixture — the same trial validated
 * against Benjamin's verified workbook earlier in this project, so these
 * are real, pre-verified numbers, not invented test data.
 */
const {
  formatPValue,
  interpretComparison,
  chartCaption,
  interpretFarmerSeason,
  generateFarmerRecommendation,
  LOW_POWER_CAVEAT
} = require('./interpretation.engine');

// §3.2/§3.6 of the capstone validation — Yield: not significant.
const YIELD_FIXTURE = {
  metricLabel: 'Yield',
  unit: 'kg',
  treatmentA: 'CA',
  treatmentB: 'CF',
  meanA: 16.275,
  meanB: 14.55,
  tTest: {
    tStat: 1.1634906741195388,
    df: 6,
    pValue: 0.2888034213246582,
    significant: false,
    ci95: { lower: -1.9028098631252173, upper: 5.352809863125213 }
  },
  lsd: 3.627809863125205,
  replicatesPerTreatment: 4
};

// §3.2/§3.6 — C_SD Cost: significant (p < 0.001).
const CSD_FIXTURE = {
  metricLabel: 'C_SD Cost',
  unit: 'RWF',
  treatmentA: 'CA',
  treatmentB: 'CF',
  meanA: 482.03125,
  meanB: 355.46875,
  tTest: {
    tStat: 41.37106739487518,
    df: 6,
    pValue: 0.00000001, // the workbook reports "< 0.001"; any value below the threshold exercises the same branch
    significant: true,
    ci95: { lower: 119.07689953906295, upper: 134.04810046093704 }
  },
  lsd: 7.485600460937046,
  replicatesPerTreatment: 4
};

describe('formatPValue', () => {
  test('reports exact p-values above 0.001', () => {
    expect(formatPValue(0.2888034213246582)).toBe('p = 0.2888');
  });

  test('reports "p < 0.001" below the threshold', () => {
    expect(formatPValue(0.00000001)).toBe('p < 0.001');
  });
});

describe('interpretComparison — §4.1 Researcher Mode', () => {
  test('states the numeric direction and magnitude regardless of significance', () => {
    const sentence = interpretComparison(YIELD_FIXTURE);
    expect(sentence).toContain('CA had a higher mean Yield than CF');
    expect(sentence).toMatch(/16\.2[78] vs 14\.55 kg/);
    expect(sentence).toContain('a difference of 1.72 kg');
  });

  test('non-significant result never claims "no difference", and includes the CI-spans-zero caveat', () => {
    const sentence = interpretComparison(YIELD_FIXTURE);
    expect(sentence).not.toMatch(/no difference/i);
    expect(sentence).toContain('is not statistically significant');
    expect(sentence).toContain('t(6) = 1.16');
    expect(sentence).toContain('p = 0.2888');
    expect(sentence).toContain('spans zero');
    expect(sentence).not.toContain('least significant difference');
  });

  test('significant result cites the LSD instead of the CI-spans-zero caveat', () => {
    const sentence = interpretComparison(CSD_FIXTURE);
    expect(sentence).toContain('CA had a higher mean C_SD Cost than CF');
    expect(sentence).toContain('is statistically significant');
    expect(sentence).toContain('p < 0.001');
    expect(sentence).toContain('exceeds the least significant difference (LSD = 7.49)');
    expect(sentence).not.toContain('spans zero');
  });

  test('appends the fixed low-power caveat verbatim when replicates < 5', () => {
    const sentence = interpretComparison(YIELD_FIXTURE);
    expect(sentence).toContain(LOW_POWER_CAVEAT);
  });

  test('omits the low-power caveat when replicates >= 5', () => {
    const sentence = interpretComparison({ ...YIELD_FIXTURE, replicatesPerTreatment: 6 });
    expect(sentence).not.toContain(LOW_POWER_CAVEAT);
  });

  test('flips direction correctly when treatment B leads', () => {
    const sentence = interpretComparison({
      ...YIELD_FIXTURE,
      meanA: 10,
      meanB: 20,
      tTest: { ...YIELD_FIXTURE.tTest, significant: false }
    });
    expect(sentence).toContain('CA had a lower mean Yield than CF');
    expect(sentence).toContain('a difference of 10.00 kg');
  });

  test('a variable with no test result still states the descriptive comparison', () => {
    const sentence = interpretComparison({
      metricLabel: 'Plot Size',
      unit: 'm²',
      treatmentA: 'CA',
      treatmentB: 'CF',
      meanA: 100,
      meanB: 100
    });
    expect(sentence).toBe('CA had a higher mean Plot Size than CF (100.00 vs 100.00 m²), a difference of 0.00 m².');
  });
});

describe('chartCaption — §4.1', () => {
  test('names the leading treatment and direction independent of the full paragraph', () => {
    const caption = chartCaption(YIELD_FIXTURE);
    expect(caption).toContain('CA 16.27');
    expect(caption).toContain('CF 14.55');
    expect(caption).toContain('CA higher');
  });
});

describe('interpretFarmerSeason — §4.2 Farmer Mode', () => {
  test('never mentions p-values, SD, or confidence intervals', () => {
    const sentence = interpretFarmerSeason({
      harvestKg: 16.7,
      incomeRwf: 20040,
      profitRwf: 7426.99,
      priorSeasonProfitRwf: 5000,
      cooperativeAvgProfitRwf: 6000
    });
    expect(sentence).not.toMatch(/p\s*=|standard deviation|confidence interval/i);
  });

  test('single-season farmer gets a plain statement with no comparison language', () => {
    const sentence = interpretFarmerSeason({ harvestKg: 16.7, incomeRwf: 20040, profitRwf: 7426.99 });
    expect(sentence).toBe('This season you harvested 16.7 kg and earned 20040 RWF, leaving 7427 RWF profit after costs.');
    expect(sentence).not.toMatch(/last season|cooperative/i);
  });

  test('includes a prior-season comparison only when one is supplied', () => {
    const sentence = interpretFarmerSeason({
      harvestKg: 16.7,
      incomeRwf: 20040,
      profitRwf: 7426.99,
      priorSeasonProfitRwf: 5000
    });
    expect(sentence).toContain("more than last season's 5000 RWF profit");
    expect(sentence).toContain('49% increase');
  });

  test('includes a cooperative benchmark only when one is supplied', () => {
    const sentence = interpretFarmerSeason({
      harvestKg: 16.7,
      incomeRwf: 20040,
      profitRwf: 7426.99,
      cooperativeAvgProfitRwf: 6000
    });
    expect(sentence).toContain('Farmers in your cooperative averaged 6000 RWF profit this season.');
  });
});

describe('generateFarmerRecommendation — §2.5', () => {
  test('returns null when there is no prior season to compare against', () => {
    expect(generateFarmerRecommendation({ Fertilizer: 10000 }, null)).toBeNull();
  });

  test('returns null when nothing actually increased', () => {
    expect(
      generateFarmerRecommendation({ Fertilizer: 8000, Labour: 2000 }, { Fertilizer: 10000, Labour: 3000 })
    ).toBeNull();
  });

  test('names the category with the largest RWF increase, never an unrecorded category', () => {
    const rec = generateFarmerRecommendation(
      { Fertilizer: 15000, Labour: 2000, Seeds: 1200 },
      { Fertilizer: 10000, Labour: 2000, Seeds: 1000 }
    );
    expect(rec).toContain('Fertilizer');
    expect(rec).toContain('up 5000 RWF');
    expect(rec).not.toContain('Labour');
  });
});
