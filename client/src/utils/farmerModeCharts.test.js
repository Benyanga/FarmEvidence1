import { costCategoryChart, ownHistoryChart } from './farmerModeCharts';

describe('costCategoryChart', () => {
  const categories = [
    { label: 'Labour', value: 8000 },
    { label: 'Fertiliser/Compost', value: 5000 },
    { label: 'Seeds', value: 3000 }
  ];

  it('renders one bar per category with a bold data label', () => {
    const svg = costCategoryChart({ categories, color: '#1E2D40' });
    expect(svg.match(/<rect/g)).toHaveLength(3);
    expect(svg).toContain('8,000');
    expect(svg).toContain('5,000');
    expect(svg).toContain('3,000');
    expect(svg).toContain('font-weight="700"');
  });

  it('uses one accent colour at decreasing opacity per category, never a rainbow palette', () => {
    const svg = costCategoryChart({ categories, color: '#1E2D40' });
    const fills = [...svg.matchAll(/fill="(rgba\([^)]+\))"/g)].map((m) => m[1]);
    expect(fills).toHaveLength(3);
    // Same base colour (30, 45, 64) throughout, decreasing alpha by rank.
    fills.forEach((f) => expect(f).toContain('30, 45, 64'));
    const alphas = fills.map((f) => Number(f.match(/,\s*([\d.]+)\)$/)[1]));
    expect(alphas[0]).toBeGreaterThan(alphas[1]);
    expect(alphas[1]).toBeGreaterThan(alphas[2]);
  });

  it('shows the category labels and the y-axis unit', () => {
    const svg = costCategoryChart({ categories, color: '#1E2D40', unit: 'RWF' });
    expect(svg).toContain('Labour');
    expect(svg).toContain('Fertiliser/Compost');
    expect(svg).toContain('Seeds');
    expect(svg).toContain('>RWF<');
  });
});

describe('ownHistoryChart', () => {
  it('renders one bar per season with no legend (single series)', () => {
    const svg = ownHistoryChart({
      seasons: [
        { label: 'Season 1', value: 4000, system: 'CA' },
        { label: 'Season 2', value: 5000, system: 'CA' },
        { label: 'Season 3', value: 7000, system: 'CA' }
      ],
      currentSystem: 'CA',
      color: '#1E2D40'
    });
    expect(svg.match(/<rect/g)).toHaveLength(3);
  });

  it('tags only the seasons whose system differs from the current one', () => {
    const svg = ownHistoryChart({
      seasons: [
        { label: 'Season 1', value: 4000, system: 'CF' },
        { label: 'Season 2', value: 9000, system: 'CA' }
      ],
      currentSystem: 'CA',
      color: '#1E2D40'
    });
    expect(svg).toContain('(CF)');
    expect(svg).not.toContain('(CA)');
  });

  it('never shows a system tag when every recorded season used the current system', () => {
    const svg = ownHistoryChart({
      seasons: [{ label: 'Season 1', value: 4000, system: 'CA' }, { label: 'Season 2', value: 9000, system: 'CA' }],
      currentSystem: 'CA',
      color: '#1E2D40'
    });
    expect(svg).not.toContain('(CA)');
    expect(svg).not.toContain('(CF)');
  });
});
