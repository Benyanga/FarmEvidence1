import {
  formatThousands,
  formatSignedPercent,
  indicatorSuperiority,
  costLineTag,
  interpretResultsTable,
  mechanismParagraph,
  ciDirectionStatement,
  powerCaveatStatement,
  interpretStatisticalResult,
  synthesisText,
  conclusiveResultStatement,
  anomalyStatements,
  sensitivityRobustnessStatement,
  blockEffectStatement,
  descriptiveStatsFootnote,
  buildResultsDiscussion
} from './trialModeInterpretation';

describe('formatThousands', () => {
  it('adds thousands separators for values >= 1000', () => {
    expect(formatThousands(12605.981, 2)).toBe('12,605.98');
  });

  it('uses the minus glyph, not a hyphen, for negative values', () => {
    expect(formatThousands(-1.73, 2)).toBe('−1.73');
  });
});

describe('formatSignedPercent', () => {
  it('always carries a sign', () => {
    expect(formatSignedPercent(11.9)).toBe('+11.9%');
    expect(formatSignedPercent(-11.9)).toBe('−11.9%');
  });
});

describe('indicatorSuperiority', () => {
  it('flags the treatment with the higher value for higher-is-better indicators', () => {
    expect(indicatorSuperiority({ indicatorKey: 'bcr', treatmentA: 'CA', treatmentB: 'CF', meanA: 1.8, meanB: 1.5 }))
      .toEqual({ superior: 'CA', label: 'CA superior' });
  });

  it('flags the treatment with the lower value for lower-is-better indicators', () => {
    expect(indicatorSuperiority({ indicatorKey: 'breakEvenYield', treatmentA: 'CA', treatmentB: 'CF', meanA: 800, meanB: 650 }))
      .toEqual({ superior: 'CF', label: 'CF superior' });
  });

  it('never forces a winner when there is no difference', () => {
    expect(indicatorSuperiority({ indicatorKey: 'roi', treatmentA: 'CA', treatmentB: 'CF', meanA: 20, meanB: 20 }).superior).toBeNull();
  });
});

describe('costLineTag', () => {
  it('tags a line that exists for only one treatment', () => {
    expect(costLineTag({ existsForA: true, existsForB: false, meanA: 5000, meanB: 0, treatmentA: 'CA', treatmentB: 'CF' })).toBe('CA-specific');
  });

  it('tags numerically identical lines as standardised', () => {
    expect(costLineTag({ existsForA: true, existsForB: true, meanA: 1000, meanB: 1000 })).toBe('Standardised');
  });

  it('tags differing lines present in both treatments as within-treatment variation', () => {
    expect(costLineTag({ existsForA: true, existsForB: true, meanA: 1200, meanB: 900 })).toBe('Within-treatment variation');
  });
});

describe('interpretResultsTable (Section 3.1 ordering)', () => {
  it('states headline, % difference, cost driver, then so-what in that order', () => {
    const sentence = interpretResultsTable({
      metricLabel: 'Net Benefit',
      unit: 'RWF/plot',
      treatmentA: 'CA',
      treatmentB: 'CF',
      meanA: 18000,
      meanB: 16087,
      costDriverLabel: 'mulch acquisition and application',
      soWhat: 'This supports the trial objective of testing whether CA improves plot-level profitability.'
    });

    const headlineIdx = sentence.indexOf('CA recorded a higher mean Net Benefit');
    const pctIdx = sentence.indexOf('+11.9%');
    const driverIdx = sentence.indexOf('mulch acquisition');
    const soWhatIdx = sentence.indexOf('supports the trial objective');

    expect(headlineIdx).toBeGreaterThanOrEqual(0);
    expect(pctIdx).toBeGreaterThan(headlineIdx);
    expect(driverIdx).toBeGreaterThan(pctIdx);
    expect(soWhatIdx).toBeGreaterThan(driverIdx);
  });

  it('does not restate every row — omits driver/so-what when not given', () => {
    const sentence = interpretResultsTable({ metricLabel: 'Yield', unit: 'kg/plot', treatmentA: 'CA', treatmentB: 'CF', meanA: 16.28, meanB: 14.55 });
    expect(sentence).not.toContain('driven primarily');
  });
});

describe('mechanismParagraph', () => {
  it('names and quantifies the largest cost/labour driver', () => {
    const sentence = mechanismParagraph({
      treatmentA: 'CA',
      treatmentB: 'CF',
      unit: 'minutes',
      costLines: [
        { label: 'weeding labour', meanA: 40, meanB: 100 },
        { label: 'land preparation', meanA: 60, meanB: 65 }
      ]
    });

    expect(sentence).toContain('weeding labour');
    expect(sentence).toContain('40.00 minutes under CA');
    expect(sentence).toContain('100.00 minutes under CF');
    expect(sentence).toContain('60.0% reduction');
  });

  it('returns null when no cost line actually differs', () => {
    expect(mechanismParagraph({ treatmentA: 'CA', treatmentB: 'CF', costLines: [{ label: 'seed', meanA: 500, meanB: 500 }] })).toBeNull();
  });
});

describe('ciDirectionStatement', () => {
  it('reports strong asymmetry toward the treatment the interval leans on', () => {
    expect(ciDirectionStatement({ lower: -1, upper: 10 }, 'CA', 'CF')).toBe('the interval spans zero but is strongly asymmetric toward CA');
  });

  it('reports roughly symmetric when bounds are close in magnitude', () => {
    expect(ciDirectionStatement({ lower: -5, upper: 5.5 }, 'CA', 'CF')).toBe('the interval is roughly symmetric around zero');
  });

  it('returns null when the interval does not span zero', () => {
    expect(ciDirectionStatement({ lower: 2, upper: 8 }, 'CA', 'CF')).toBeNull();
  });
});

describe('powerCaveatStatement', () => {
  it('adds the power caveat for a non-significant result with small n', () => {
    expect(powerCaveatStatement({ significant: false, n: 4, df: 6 })).toContain("study's statistical power constraint");
  });

  it('drops the power caveat once n >= 15, even if non-significant', () => {
    expect(powerCaveatStatement({ significant: false, n: 15, df: 28 })).toBeNull();
  });

  it('never adds a power caveat to a significant result', () => {
    expect(powerCaveatStatement({ significant: true, n: 4, df: 6 })).toBeNull();
  });
});

describe('interpretStatisticalResult', () => {
  it('states significant results plainly with no softening language', () => {
    const sentence = interpretStatisticalResult({
      metricLabel: 'C_SD', unit: 'RWF/plot', treatmentA: 'CA', treatmentB: 'CF',
      meanA: 5000, meanB: 8000, tStat: 4.2, df: 6, pValue: 0.004, significant: true, lsd: 900
    });
    expect(sentence).toContain('highly significant');
    expect(sentence).toContain('REJECT H0');
    expect(sentence).not.toContain('could reflect');
  });

  it('adds the power caveat and CI direction for a non-significant small-n result', () => {
    const sentence = interpretStatisticalResult({
      metricLabel: 'Yield', unit: 'kg/plot', treatmentA: 'CA', treatmentB: 'CF',
      meanA: 16.275, meanB: 14.55, tStat: 1.163, df: 6, pValue: 0.2888, significant: false,
      ci95: { lower: -1.9, upper: 5.35 }, n: 4
    });
    expect(sentence).toContain('FAIL TO REJECT H0');
    expect(sentence).toContain("power constraint (n = 4 per treatment, df = 6)");
    expect(sentence).toContain('asymmetric toward CA');
  });
});

describe('synthesisText (cross-metric coherence check)', () => {
  it('generates the synthesis paragraph when a clear majority of metrics agree', () => {
    const metrics = [
      { name: 'Yield', favors: 'CA' }, { name: 'Net Benefit', favors: 'CA' },
      { name: 'BCR', favors: 'CA' }, { name: 'ROI', favors: 'CA' },
      { name: 'Cost per kg', favors: 'CA' }, { name: 'Break-Even Yield', favors: 'CF' }
    ];
    const text = synthesisText(metrics);
    expect(text).toContain('5 of the 6 independently measured outcome metrics favor CA');
  });

  it('never forces the synthesis argument when metrics are mixed', () => {
    const metrics = [{ name: 'Yield', favors: 'CA' }, { name: 'Net Benefit', favors: 'CF' }, { name: 'BCR', favors: 'CA' }, { name: 'ROI', favors: 'CF' }];
    expect(synthesisText(metrics)).toBeNull();
  });
});

describe('conclusiveResultStatement', () => {
  it('calls out the single significant variable and checks it against the partial budget', () => {
    const sentence = conclusiveResultStatement({
      variables: [{ name: 'C_SD', pValue: 0.004, favors: 'CF' }, { name: 'Yield', pValue: 0.29, favors: 'CA' }],
      partialBudget: { netChange: 5000 }
    });
    expect(sentence).toContain('C_SD is the one result where the statistical evidence is conclusive');
    expect(sentence).toContain('pays for itself');
  });

  it('returns null when more than one variable is significant', () => {
    expect(conclusiveResultStatement({ variables: [{ name: 'A', pValue: 0.01 }, { name: 'B', pValue: 0.02 }] })).toBeNull();
  });
});

describe('anomalyStatements', () => {
  it('states a block reversal plainly and admits when no explanation was recorded', () => {
    const statements = anomalyStatements({
      overallFavors: 'CA', treatmentA: 'CA', treatmentB: 'CF',
      blocks: [{ label: 'Block 2', favors: 'CF' }, { label: 'Block 1', favors: 'CA' }]
    });
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('Block 2 reverses the overall pattern');
    expect(statements[0]).toContain('no specific field observation was recorded');
  });

  it('uses the recorded field note instead of fabricating a reason', () => {
    const statements = anomalyStatements({
      overallFavors: 'CA', treatmentA: 'CA', treatmentB: 'CF',
      blocks: [{ label: 'Block 2', favors: 'CF', note: 'uneven mulch coverage was observed on this block' }]
    });
    expect(statements[0]).toContain('uneven mulch coverage was observed');
  });
});

describe('sensitivityRobustnessStatement', () => {
  it('confirms robustness when the favored treatment wins in all three scenarios', () => {
    const sentence = sensitivityRobustnessStatement({ favoredTreatment: 'CA', scenarios: { pessimistic: 'CA', expected: 'CA', optimistic: 'CA' } });
    expect(sentence).toContain('holds under all three market scenarios');
  });

  it('states the reversal directly instead of suppressing it', () => {
    const sentence = sensitivityRobustnessStatement({ favoredTreatment: 'CA', scenarios: { pessimistic: 'CF', expected: 'CA', optimistic: 'CA' } });
    expect(sentence).toContain('reverses under the pessimistic scenario');
  });
});

describe('blockEffectStatement', () => {
  it('states blocking was informative when the block effect is significant', () => {
    expect(blockEffectStatement({ significant: true, fValue: 5.1, pValue: 0.02 })).toContain('blocking was informative');
  });

  it('suggests simplifying the design when the block effect is not significant', () => {
    expect(blockEffectStatement({ significant: false, fValue: 0.8, pValue: 0.5 })).toContain('could be simplified');
  });
});

describe('descriptiveStatsFootnote', () => {
  it('prints the actual t-critical and df used, not a placeholder', () => {
    expect(descriptiveStatsFootnote({ tCritical: 2.447, df: 6 })).toBe('95% CI computed using t critical = 2.447, df = 6 (n1 + n2 − 2), two-tailed, α = 0.05.');
  });
});

describe('buildResultsDiscussion', () => {
  it('assembles only the applicable building blocks, in spec order', () => {
    const paragraphs = buildResultsDiscussion({
      treatmentA: 'CA',
      treatmentB: 'CF',
      metrics: [
        { name: 'Yield', favors: 'CA' }, { name: 'Net Benefit', favors: 'CA' }, { name: 'BCR', favors: 'CA' },
        { name: 'ROI', favors: 'CA' }, { name: 'Cost per kg', favors: 'CA' }, { name: 'Break-Even Yield', favors: 'CF' }
      ],
      costLines: [{ label: 'weeding labour', meanA: 40, meanB: 100 }],
      variables: [{ name: 'C_SD', pValue: 0.004, favors: 'CF' }],
      partialBudget: { netChange: 5000 },
      overallFavors: 'CA',
      blocks: [{ label: 'Block 2', favors: 'CF' }],
      favoredTreatment: 'CA',
      scenarios: { pessimistic: 'CA', expected: 'CA', optimistic: 'CA' }
    });

    expect(paragraphs[0]).toContain('independently measured outcome metrics favor CA');
    expect(paragraphs[1]).toContain('weeding labour');
    expect(paragraphs[2]).toContain('one result where the statistical evidence is conclusive');
    expect(paragraphs[3]).toContain('Block 2 reverses');
    expect(paragraphs[4]).toContain('holds under all three market scenarios');
    expect(paragraphs).toHaveLength(5);
  });

  it('omits every conditional paragraph when nothing applies, returning an empty list', () => {
    const paragraphs = buildResultsDiscussion({ treatmentA: 'CA', treatmentB: 'CF' });
    expect(paragraphs).toEqual([]);
  });
});
