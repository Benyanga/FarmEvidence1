import {
  categorizeCostItem,
  buildCostCategories,
  costCategoryInterpretation,
  seasonAtAGlanceSummary,
  interpretProfitabilityIndicator,
  rankCostItemsByChange,
  whatThisMeansParagraph,
  seasonComparisonParagraph
} from './farmerModeInterpretation';

describe('seasonAtAGlanceSummary', () => {
  it('states the exact fixed headline template', () => {
    expect(seasonAtAGlanceSummary({ harvestKg: 16.7, crop: 'Bean', revenue: 20040, cost: 12613, profit: 7427 }))
      .toBe('This season you harvested 16.7 kg of Bean and earned 20,040 RWF in revenue. After 12,613 RWF in costs, your net profit was 7,427 RWF.');
  });

  it('omits the crop clause gracefully when crop is unknown', () => {
    expect(seasonAtAGlanceSummary({ harvestKg: 10, revenue: 5000, cost: 2000, profit: 3000 }))
      .toBe('This season you harvested 10.0 kg and earned 5,000 RWF in revenue. After 2,000 RWF in costs, your net profit was 3,000 RWF.');
  });
});

describe('categorizeCostItem', () => {
  it('buckets seed-related input names as Seeds', () => {
    expect(categorizeCostItem('Bean seed (RWV 1129)')).toBe('Seeds');
  });

  it('buckets fertiliser/compost-related input names', () => {
    expect(categorizeCostItem('NPK fertilizer')).toBe('Fertiliser/Compost');
    expect(categorizeCostItem('Farmyard compost')).toBe('Fertiliser/Compost');
  });

  it('falls back to Other Inputs for anything else', () => {
    expect(categorizeCostItem('Pesticide spray')).toBe('Other Inputs');
  });
});

describe('buildCostCategories', () => {
  it('rolls raw cost rows and the labour ledger into farmer-facing categories, sorted largest first', () => {
    const categories = buildCostCategories({
      inputCosts: [
        { inputName: 'Bean seed', totalCost: 3000 },
        { inputName: 'NPK', totalCost: 5000 },
        { inputName: 'Pesticide', totalCost: 1000 }
      ],
      laborCostTotal: 8000
    });

    expect(categories).toEqual([
      { label: 'Labour', value: 8000 },
      { label: 'Fertiliser/Compost', value: 5000 },
      { label: 'Seeds', value: 3000 },
      { label: 'Other Inputs', value: 1000 }
    ]);
  });

  it('never emits the internal C_SD/C_SI split', () => {
    const categories = buildCostCategories({ inputCosts: [{ inputName: 'Weeding', totalCost: 2000 }], laborCostTotal: 0 });
    const labels = categories.map((c) => c.label);
    expect(labels).not.toContain('C_SD');
    expect(labels).not.toContain('C_SI');
  });
});

describe('costCategoryInterpretation', () => {
  it('names the single largest cost category and its share', () => {
    const text = costCategoryInterpretation([
      { label: 'Labour', value: 8000 },
      { label: 'Seeds', value: 2000 }
    ]);
    expect(text).toBe('Your largest cost this season was Labour at 80% of total spending.');
  });

  it('returns null when there are no recorded costs', () => {
    expect(costCategoryInterpretation([])).toBeNull();
  });
});

describe('interpretProfitabilityIndicator', () => {
  it('states BCR in plain per-1-RWF terms', () => {
    expect(interpretProfitabilityIndicator('bcr', { value: 1.85 })).toBe('For every 1 RWF you spent, you earned 1.85 RWF back.');
  });

  it('states cost per kg in plain terms', () => {
    expect(interpretProfitabilityIndicator('costPerKg', { value: 450 })).toBe('It cost you 450 RWF to produce each kilogram.');
  });

  it('states break-even yield with direction and margin when above break-even', () => {
    const text = interpretProfitabilityIndicator('breakEvenYield', { value: 120, actualYield: 150 });
    expect(text).toBe('You needed to harvest at least 120.0 kg to cover your costs; you harvested 150.0 kg, so you were above break-even by 30.0 kg.');
  });

  it('states break-even yield with direction when below break-even', () => {
    const text = interpretProfitabilityIndicator('breakEvenYield', { value: 120, actualYield: 90 });
    expect(text).toContain('below break-even by 30.0 kg');
  });

  it('never uses statistics vocabulary anywhere in its templates', () => {
    const all = [
      interpretProfitabilityIndicator('netProfitPerPlot', { value: 5000 }),
      interpretProfitabilityIndicator('bcr', { value: 1.5 }),
      interpretProfitabilityIndicator('costPerKg', { value: 400 }),
      interpretProfitabilityIndicator('breakEvenYield', { value: 100, actualYield: 120 })
    ].join(' ');
    expect(all).not.toMatch(/p-value|significant|standard deviation|confidence interval|ANOVA/i);
  });
});

describe('whatThisMeansParagraph', () => {
  it('states a profitable season plainly and names the fastest-growing cost when prior data exists', () => {
    const paragraphs = whatThisMeansParagraph({
      profit: 12000,
      currentItems: [{ label: 'Weeding labour', value: 6000 }, { label: 'Seeds', value: 3000 }],
      priorItems: [{ label: 'Weeding labour', value: 3000 }, { label: 'Seeds', value: 3000 }]
    });
    expect(paragraphs[0]).toContain('profitable, earning');
    expect(paragraphs[1]).toContain('Weeding labour cost rose sharply');
    expect(paragraphs[1]).toContain('100%');
  });

  it('states a net loss plainly', () => {
    const paragraphs = whatThisMeansParagraph({ profit: -4000, currentItems: [] });
    expect(paragraphs[0]).toContain('net loss of 4,000 RWF');
  });

  it('falls back to the largest recorded cost item when there is no prior-season comparison', () => {
    const paragraphs = whatThisMeansParagraph({
      profit: 5000,
      currentItems: [{ label: 'Seeds', value: 2000 }, { label: 'Labour', value: 6000 }]
    });
    expect(paragraphs[1]).toContain('largest single cost this season was Labour');
  });

  it('never recommends switching farming system', () => {
    const paragraphs = whatThisMeansParagraph({ profit: -1000, currentItems: [{ label: 'Labour', value: 1000 }] });
    expect(paragraphs.join(' ')).not.toMatch(/switch|adopt CA|adopt CF|change system/i);
  });
});

describe('seasonComparisonParagraph', () => {
  it('omits the section entirely when there is no prior season and no cooperative benchmark', () => {
    expect(seasonComparisonParagraph({ currentSystem: 'CA', currentProfit: 5000, priorSeasons: [] })).toBeNull();
  });

  it('uses the cooperative benchmark only when there is no prior personal season', () => {
    const text = seasonComparisonParagraph({ currentSystem: 'CA', currentProfit: 5000, priorSeasons: [], cooperativeAvgProfit: 6000 });
    expect(text).toBe('Farmers in your cooperative averaged 6,000 RWF net profit this season; you earned 5,000 RWF.');
  });

  it('directly compares profit when the prior season used the same system', () => {
    const text = seasonComparisonParagraph({
      currentSystem: 'CA',
      currentProfit: 7000,
      priorSeasons: [{ season: 3, farmingSystem: 'CA', profit: 5000 }]
    });
    expect(text).toContain('7,000 RWF, 40% higher than last season\'s 5,000 RWF');
    expect(text).not.toMatch(/versus|compared to CF|CA is better/i);
  });

  it('never uses a comparison framing when the farmer switched systems — states the fact plainly instead', () => {
    const text = seasonComparisonParagraph({
      currentSystem: 'CA',
      currentProfit: 7000,
      priorSeasons: [{ season: 3, farmingSystem: 'CF', profit: 5000 }]
    });
    expect(text).toContain('You farmed under CA this season, compared to CF last season');
    expect(text).toContain('treat this as your own record rather than a controlled comparison');
  });

  it('never draws a cooperative comparison when a prior personal season also exists', () => {
    const text = seasonComparisonParagraph({
      currentSystem: 'CA',
      currentProfit: 7000,
      priorSeasons: [{ season: 3, farmingSystem: 'CA', profit: 5000 }],
      cooperativeAvgProfit: 9999
    });
    expect(text).not.toContain('cooperative');
  });

  it('adds the 3-season trend statement only once 3+ same-system seasons exist, never a stronger claim', () => {
    const text = seasonComparisonParagraph({
      currentSystem: 'CA',
      currentProfit: 9000,
      priorSeasons: [
        { season: 3, farmingSystem: 'CA', profit: 7000 },
        { season: 2, farmingSystem: 'CA', profit: 5000 }
      ]
    });
    expect(text).toContain('Over your last 3 seasons, your net profit has risen.');
    expect(text).not.toMatch(/proves|caused|because you (farmed|used)/i);
  });

  it('stops the same-system run at the first season that used a different system', () => {
    const text = seasonComparisonParagraph({
      currentSystem: 'CA',
      currentProfit: 9000,
      priorSeasons: [
        { season: 3, farmingSystem: 'CA', profit: 7000 },
        { season: 2, farmingSystem: 'CF', profit: 5000 },
        { season: 1, farmingSystem: 'CA', profit: 4000 }
      ]
    });
    expect(text).not.toContain('last 3 seasons');
  });
});
