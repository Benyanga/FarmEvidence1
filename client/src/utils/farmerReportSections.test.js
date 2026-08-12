import { buildFarmerReportContent } from './farmerReportSections';

function makeFixture(overrides = {}) {
  return {
    farmerName: 'Tuzamurane Youth Cooperative',
    system: 'CA',
    crop: 'Bean',
    seasonLabel: 'Season B 2026',
    location: 'Huye, Southern Province',
    harvestKg: 16.7,
    revenue: 20040,
    cost: 12613,
    profit: 7427,
    profitPerHa: 6189167,
    bcr: 1.59,
    costPerKg: 755,
    breakEvenYield: 10.5,
    inputCosts: [
      { inputName: 'Bean seed', totalCost: 3000, date: '2026-02-01' },
      { inputName: 'NPK fertilizer', totalCost: 4000, date: '2026-02-10' }
    ],
    laborCosts: [{ activity: 'Weeding', laborCost: 5613, date: '2026-03-01' }],
    priorSeasons: [],
    cooperativeAvgProfit: null,
    ...overrides
  };
}

function allText(content) {
  return content
    .map((node) => {
      if (typeof node?.text === 'string') return node.text;
      if (Array.isArray(node?.text)) return node.text.join(' ');
      if (node?.table) return node.table.body.map((row) => row.map((c) => c.text).join(' ')).join(' ');
      if (node?.stack) return allText(node.stack);
      if (typeof node?.svg === 'string') return node.svg;
      return '';
    })
    .join('\n');
}

function findText(content, predicate) {
  return content.find((node) => typeof node?.text === 'string' && predicate(node.text));
}

describe('buildFarmerReportContent', () => {
  it('renders every unconditional section', () => {
    const { content } = buildFarmerReportContent(makeFixture());
    expect(findText(content, (t) => t.includes('Season at a Glance'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Where Your Money Went'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Profitability Indicators'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('What This Means for You'))).toBeTruthy();
    expect(findText(content, (t) => t.includes('Your Season, in Detail'))).toBeTruthy();
  });

  it('never frames the report as a CA-vs-CF comparison', () => {
    const { content } = buildFarmerReportContent(makeFixture());
    const text = allText(content);
    expect(text).not.toMatch(/\bversus\b/i);
    expect(text).not.toMatch(/CA is better|CF is better|CA outperform|CF outperform/i);
  });

  it('never uses statistics vocabulary anywhere in the report', () => {
    const { content } = buildFarmerReportContent(makeFixture());
    const text = allText(content);
    expect(text).not.toMatch(/p-value|standard deviation|confidence interval|ANOVA|significant/i);
  });

  it('omits "How This Season Compares" entirely when there is no prior season and no cooperative benchmark', () => {
    const { content } = buildFarmerReportContent(makeFixture());
    expect(findText(content, (t) => t.includes('How This Season Compares'))).toBeFalsy();
  });

  it('includes "How This Season Compares" with a same-system history chart when a prior season exists', () => {
    const { content } = buildFarmerReportContent(
      makeFixture({ priorSeasons: [{ season: 3, farmingSystem: 'CA', profit: 5000 }] })
    );
    const section = findText(content, (t) => t.includes('How This Season Compares'));
    expect(section).toBeTruthy();
    const svgNode = content.find((node) => typeof node?.svg === 'string' && node.svg.includes('Season 3'));
    expect(svgNode).toBeTruthy();
    expect(allText(content)).toContain("higher than last season's");
  });

  it('uses the cooperative benchmark sentence only when there is no prior personal season', () => {
    const { content } = buildFarmerReportContent(makeFixture({ cooperativeAvgProfit: 6000 }));
    expect(allText(content)).toContain('Farmers in your cooperative averaged');
  });

  it('shows the Seeds/Fertiliser/Labour categories, never the internal C_SD/C_SI split', () => {
    const { content } = buildFarmerReportContent(makeFixture());
    const text = allText(content);
    expect(text).toContain('Seeds');
    expect(text).toContain('Fertiliser/Compost');
    expect(text).not.toContain('C_SD');
    expect(text).not.toContain('C_SI');
  });

  it('provides a Farmer-Mode-specific header, footer, and styles — never the Researcher Mode ones', () => {
    const { header, footer, styles } = buildFarmerReportContent(makeFixture());
    expect(styles.farmerHeaderLine).toBeDefined();
    expect(styles.farmerFooter).toBeDefined();

    const headerNode = header();
    expect(JSON.stringify(headerNode)).toContain('CA');
    expect(JSON.stringify(headerNode).toUpperCase()).toContain('TUZAMURANE');

    const footerNode = footer(3, 5);
    expect(footerNode.text).toBe('3');
    expect(footerNode.alignment).toBe('center');
  });

  it('omits Profitability Indicators rows for indicators with no data, rather than showing blanks', () => {
    const { content } = buildFarmerReportContent(makeFixture({ profitPerHa: null, breakEvenYield: null }));
    const table = content.find((node) => node?.table && node.table.body.some((row) => row[0]?.text === 'Indicator'));
    const rowLabels = table.table.body.slice(1).map((row) => row[0].text);
    expect(rowLabels).not.toContain('Net Profit per hectare');
    expect(rowLabels).not.toContain('Break-even yield');
    expect(rowLabels).toContain('Benefit-Cost Ratio');
  });
});
