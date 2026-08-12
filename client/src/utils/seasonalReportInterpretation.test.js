import {
  formatNumber,
  interpretComparison,
  chartCaption,
  interpretFarmerSeason,
  generateFarmerRecommendation
} from './seasonalReportInterpretation';

describe('seasonal report interpretation helpers', () => {
  it('formats numbers consistently for report copy', () => {
    expect(formatNumber(1234.5, 0)).toBe('1235');
    expect(formatNumber(0.004, 3)).toBe('0.004');
  });

  it('builds a researcher-style comparison sentence with the correct direction and caveat', () => {
    const sentence = interpretComparison({
      metricLabel: 'Yield',
      unit: 'kg',
      treatmentA: 'CA',
      treatmentB: 'CF',
      meanA: 16.275,
      meanB: 14.55,
      tTest: { tStat: 1.163, df: 6, pValue: 0.2888, significant: false, ci95: { lower: -1.9, upper: 5.35 } },
      lsd: 3.63,
      replicatesPerTreatment: 4
    });

    expect(sentence).toContain('CA had a higher mean Yield than CF');
    expect(sentence).toContain('is not statistically significant');
    expect(sentence).toContain('spans zero');
  });

  it('builds a short chart caption for the researcher mode', () => {
    const caption = chartCaption({
      metricLabel: 'Yield',
      unit: 'kg',
      treatmentA: 'CA',
      treatmentB: 'CF',
      meanA: 16.275,
      meanB: 14.55
    });

    expect(caption).toContain('CA 16.27 kg');
    expect(caption).toContain('CF 14.55 kg');
    expect(caption).toContain('CA higher');
  });

  it('builds a plain-language farmer summary that avoids statistics jargon', () => {
    const sentence = interpretFarmerSeason({
      harvestKg: 16.7,
      incomeRwf: 20040,
      profitRwf: 7426.99,
      priorSeasonProfitRwf: 5000,
      cooperativeAvgProfitRwf: 6000
    });

    expect(sentence).toContain('harvested 16.7 kg');
    expect(sentence).toContain('more than last season');
    expect(sentence).toContain('Farmers in your cooperative averaged');
  });

  it('recommends the category with the largest recorded rise in cost', () => {
    const recommendation = generateFarmerRecommendation(
      { Fertilizer: 15000, Labour: 2000, Seeds: 1200 },
      { Fertilizer: 10000, Labour: 2000, Seeds: 1000 }
    );

    expect(recommendation).toContain('Fertilizer');
    expect(recommendation).toContain('up 5000 RWF');
  });
});
