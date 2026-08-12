import {
  groupedBarChart,
  smallMultipleBarChart,
  waterfallChart,
  treatmentSeries,
  computeWaterfallBars,
  buildChartCaption,
  DEFAULT_WATERFALL_STAGES
} from './trialModeCharts';

describe('treatmentSeries', () => {
  it('resolves plain treatment codes to their fixed identity colours', () => {
    const series = treatmentSeries(['CA', 'CF']);
    expect(series).toEqual([
      { key: 'CA', label: 'CA', color: '#1E2D40' },
      { key: 'CF', label: 'CF', color: '#BA7517' }
    ]);
  });
});

describe('groupedBarChart', () => {
  const series = treatmentSeries(['CA', 'CF']);
  const data = [
    { label: 'Rep 1', values: { CA: 18000, CF: 16087 } },
    { label: 'Rep 2', values: { CA: 15500, CF: 16900 } }
  ];

  it('renders one bar per treatment per replicate group, each with a bold data label', () => {
    const svg = groupedBarChart({ data, series, unit: 'RWF/plot' });
    // 4 bars (2 treatments x 2 replicates) + 2 legend chips (2-series chart)
    expect(svg.match(/<rect/g)).toHaveLength(6);
    expect(svg).toContain('18,000');
    expect(svg).toContain('16,087');
    expect(svg).toContain('font-weight="700"');
  });

  it('shows the y-axis unit label', () => {
    expect(groupedBarChart({ data, series, unit: 'RWF/plot' })).toContain('RWF/plot');
  });

  it('omits the legend for a single-series chart', () => {
    const single = groupedBarChart({ data, series: [series[0]] });
    // a single-series chart has no chip rects beyond the 2 bars
    expect(single.match(/<rect/g)).toHaveLength(2);
  });

  it('draws a dashed reference line per treatment when means are given', () => {
    const svg = groupedBarChart({ data, series, referenceLines: { CA: 16750, CF: 16493.5 } });
    expect(svg.match(/stroke-dasharray="5,3"/g)).toHaveLength(2);
  });

  it('never draws vertical gridlines — only horizontal ones', () => {
    const svg = groupedBarChart({ data, series });
    const gridLines = svg.match(/<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"[^>]*stroke="#D4D4D0"/g) || [];
    gridLines.forEach((line) => {
      const [, y1, y2] = line.match(/y1="([\d.]+)".*y2="([\d.]+)"/);
      expect(y1).toBe(y2);
    });
    expect(gridLines.length).toBeGreaterThan(0);
  });
});

describe('smallMultipleBarChart', () => {
  it('renders three independent panels, each with its own title and axis', () => {
    const series = treatmentSeries(['CA', 'CF']);
    const svg = smallMultipleBarChart({
      series,
      panels: [
        { title: 'BCR', data: [{ label: '', values: { CA: 1.8, CF: 1.5 } }], unit: '' },
        { title: 'ROI (%)', data: [{ label: '', values: { CA: 22, CF: 18 } }], unit: '%' },
        { title: 'Cost per kg', data: [{ label: '', values: { CA: 210, CF: 260 } }], unit: 'RWF/kg' }
      ]
    });

    expect(svg).toContain('BCR');
    expect(svg).toContain('ROI (%)');
    expect(svg).toContain('Cost per kg');
    expect(svg.match(/<g transform=/g)).toHaveLength(3);
    // 6 bars (2 treatments x 3 panels) + 2 shared legend chips
    expect(svg.match(/<rect/g)).toHaveLength(8);
  });

  it('keeps the shared legend clear of the last panel title, even with a long title', () => {
    const series = treatmentSeries(['CA', 'CF']);
    const svg = smallMultipleBarChart({
      series,
      panels: [
        { title: 'BCR', data: [{ label: '', values: { CA: 1.8, CF: 1.5 } }] },
        { title: 'ROI (%)', data: [{ label: '', values: { CA: 22, CF: 18 } }], unit: '%' },
        { title: 'Cost per kg (RWF)', data: [{ label: '', values: { CA: 210, CF: 260 } }], unit: 'RWF/kg' }
      ]
    });

    // Legend chip/text sits in its own reserved row, strictly above every panel title.
    const legendChipY = Number(svg.match(/<rect x="[\d.]+" y="([\d.]+)" width="7"/)[1]);
    const titleYs = [...svg.matchAll(/<text x="[\d.]+" y="(-?[\d.]+)" font-size="\d+(?:\.\d+)?" font-weight="700" text-anchor="middle"[^>]*>(?:BCR|ROI \(%\)|Cost per kg \(RWF\))</g)];
    expect(titleYs.length).toBeGreaterThanOrEqual(1);
    // Panel <text> y is local to its <g transform="translate(x, topOffset)">; recover the absolute y from the transform.
    const gTransforms = [...svg.matchAll(/<g transform="translate\([\d.]+, ([\d.]+)\)">/g)].map((m) => Number(m[1]));
    const absoluteTitleY = gTransforms[gTransforms.length - 1] - 8; // title is drawn at local y="-8"
    expect(absoluteTitleY).toBeGreaterThan(legendChipY + 10);
  });
});

describe('computeWaterfallBars', () => {
  // computeWaterfallBars computes bars for exactly the stage list it is given —
  // callers (waterfallChart) are responsible for dropping optional stages
  // no treatment recorded, so the fixture here omits labourDifferential.
  const STAGES_WITHOUT_LABOUR = DEFAULT_WATERFALL_STAGES.filter((s) => s.key !== 'labourDifferential');

  it('anchors the first and last stages to zero and floats the cost stage from the running total', () => {
    const bars = computeWaterfallBars(STAGES_WITHOUT_LABOUR, {
      grossRevenue: 100000,
      totalProductionCost: 40000,
      netBenefit: 60000
    });

    expect(bars[0]).toEqual({ key: 'grossRevenue', y0: 0, y1: 100000, value: 100000 });
    expect(bars[1]).toEqual({ key: 'totalProductionCost', y0: 100000, y1: 60000, value: -40000 });
    expect(bars[2]).toEqual({ key: 'netBenefit', y0: 0, y1: 60000, value: 60000 });
  });

  it('chains a separately-called-out labour differential off the cost stage', () => {
    const bars = computeWaterfallBars(DEFAULT_WATERFALL_STAGES, {
      grossRevenue: 100000,
      totalProductionCost: 40000,
      labourDifferential: 5000,
      netBenefit: 55000
    });
    expect(bars[2]).toEqual({ key: 'labourDifferential', y0: 60000, y1: 55000, value: -5000 });
  });
});

describe('waterfallChart', () => {
  it('drops the optional labour-differential stage when no treatment recorded it', () => {
    const svg = waterfallChart({
      treatments: [
        { key: 'CA', label: 'CA', values: { grossRevenue: 100000, totalProductionCost: 40000, netBenefit: 60000 } },
        { key: 'CF', label: 'CF', values: { grossRevenue: 90000, totalProductionCost: 42000, netBenefit: 48000 } }
      ]
    });
    expect(svg).not.toContain('Labour Differential');
    expect(svg).toContain('Gross Revenue');
    expect(svg).toContain('Net Benefit');
  });

  it('includes the labour-differential stage when at least one treatment recorded it', () => {
    const svg = waterfallChart({
      treatments: [
        { key: 'CA', label: 'CA', values: { grossRevenue: 100000, totalProductionCost: 40000, labourDifferential: 5000, netBenefit: 55000 } },
        { key: 'CF', label: 'CF', values: { grossRevenue: 90000, totalProductionCost: 42000, netBenefit: 48000 } }
      ]
    });
    expect(svg).toContain('Labour Differential');
  });

  it('labels negative (cost) bars with the minus glyph', () => {
    const svg = waterfallChart({
      treatments: [{ key: 'CA', label: 'CA', values: { grossRevenue: 100000, totalProductionCost: 40000, netBenefit: 60000 } }]
    });
    expect(svg).toContain('−40,000');
  });
});

describe('buildChartCaption', () => {
  it('formats the numbered figure caption convention', () => {
    expect(buildChartCaption(5, 'CA outperforms CF in three of four blocks; Block 2 shows reversal.'))
      .toBe('Figure 5. CA outperforms CF in three of four blocks; Block 2 shows reversal.');
  });
});
