import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { renderChartImage } from './charts';

pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

const BRAND_GREEN = '#198754';
const MUTED = '#6b7a72';

function fmtGeneratedDate() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Shared green brand bar + report title, repeated on every page of every PDF this app generates. */
function buildPdfHeader(title) {
  return (currentPage) =>
    currentPage === 1
      ? null
      : {
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'FarmEvidence', style: 'pdfBrand', border: [false, false, false, false] },
                { text: title, style: 'pdfHeaderTitle', alignment: 'right', border: [false, false, false, false] }
              ]
            ]
          },
          layout: {
            fillColor: () => BRAND_GREEN,
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: () => 40,
            paddingRight: () => 40,
            paddingTop: () => 12,
            paddingBottom: () => 12
          }
        };
}

/** Shared footer: page number + generation date, on every page. */
function buildPdfFooter() {
  const generated = fmtGeneratedDate();
  return (currentPage, pageCount) => ({
    columns: [
      { text: `Generated ${generated}`, style: 'pdfFooter', margin: [40, 0, 0, 0] },
      { text: `Page ${currentPage} of ${pageCount}`, style: 'pdfFooter', alignment: 'right', margin: [0, 0, 40, 0] }
    ],
    margin: [0, 8, 0, 0]
  });
}

const BASE_STYLES = {
  header: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
  subheader: { fontSize: 13, bold: true, margin: [0, 10, 0, 4] },
  table: { fontSize: 9 },
  pdfBrand: { color: '#ffffff', bold: true, fontSize: 12 },
  pdfHeaderTitle: { color: '#ffffff', fontSize: 9 },
  pdfFooter: { color: MUTED, fontSize: 8 }
};

/** Cover title block — every report's own first-page header (the brand bar starts from page 2 to avoid doubling up). */
function coverBlock(title, subtitle) {
  return {
    stack: [
      { text: 'FarmEvidence', color: BRAND_GREEN, bold: true, fontSize: 13, margin: [0, 0, 0, 6] },
      { text: title, style: 'header' },
      subtitle ? { text: subtitle, style: 'subheader', margin: [0, 0, 0, 4] } : null,
      { text: `Generated ${fmtGeneratedDate()}`, color: MUTED, fontSize: 9, margin: [0, 0, 0, 10] }
    ].filter(Boolean)
  };
}

function formatRWF(value) {
  if (typeof value !== 'number') return '—';
  return `RWF ${Math.round(value).toLocaleString('en-US')}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Generates and downloads a seasonal CBA report PDF from a compute/season
 * response snapshot, with a Python-rendered chart of plot-level results.
 */
export async function downloadSeasonalCBAReport({ title, seasonLabel, snapshot, plots = [] }) {
  const plotChart = plots.length
    ? await renderChartImage({
        type: 'bar',
        labels: plots.map((p) => `Rep ${p.replicationNumber}`),
        series: [
          { name: 'Revenue', values: plots.map((p) => p.revenue || 0) },
          { name: 'Total Cost', values: plots.map((p) => p.cSystem || 0) },
          { name: 'Profit', values: plots.map((p) => p.profit || 0) }
        ],
        title: 'Plot Results',
        yLabel: 'RWF'
      })
    : null;

  const docDefinition = {
    header: buildPdfHeader(title),
    footer: buildPdfFooter(),
    pageMargins: [40, 60, 40, 50],
    content: [
      coverBlock(title, seasonLabel),
      {
        style: 'table',
        table: {
          widths: ['*', '*'],
          body: [
            ['CSI', snapshot.csi ?? '—'],
            ['Profit (CA)', formatRWF(snapshot.profitCA)],
            ['Profit (CF)', formatRWF(snapshot.profitCF)],
            ['Adoption Cost', formatRWF(snapshot.adoptionCost)],
            ['TTP', snapshot.ttp ?? '—'],
            ['CNB', formatRWF(snapshot.cnb)]
          ]
        },
        margin: [0, 10, 0, 10]
      },
      { text: 'Plot Detail', style: 'subheader' },
      {
        table: {
          widths: ['auto', 'auto', '*', '*', '*'],
          body: [
            ['Farming System', 'Rep', 'Revenue', 'C_system', 'Profit'],
            ...plots.map((p) => [p.farmingSystem, String(p.replicationNumber), formatRWF(p.revenue), formatRWF(p.cSystem), formatRWF(p.profit)])
          ]
        }
      },
      plotChart ? { text: 'Chart', style: 'subheader' } : null,
      plotChart ? { image: plotChart, width: 420 } : null
    ].filter(Boolean),
    styles: BASE_STYLES
  };

  pdfMake.createPdf(docDefinition).download(`${title.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Research Mode trial export: Trial config, CBA Summary, Cost Structure,
 * Descriptive Statistics, RCBD ANOVA (yield), Break-Even, and the Expected
 * sensitivity scenario — assembled from the same `/trials/:trialId/analysis`
 * response the Analysis dashboard renders. Partial Budget is left out since
 * it requires a baseline/alternative choice made interactively in-app.
 */
export async function downloadTrialReport({ trial, analysis }) {
  const labels = Object.keys(analysis.cbaSummary?.summary || {});
  const title = `${trial.crop}${trial.variety ? ` (${trial.variety})` : ''} — Trial Analysis Report`;

  const yieldChartImage = labels.length
    ? await renderChartImage({
        type: 'bar',
        labels,
        series: [{ name: 'Avg Yield (kg/plot)', values: labels.map((l) => analysis.cbaSummary.summary[l].avgYieldPerPlot || 0) }],
        title: 'Average Yield by Treatment',
        yLabel: 'kg/plot'
      })
    : null;

  const netBenefitChartImage = labels.length
    ? await renderChartImage({
        type: 'bar',
        labels,
        series: [{ name: 'Net Benefit (RWF)', values: labels.map((l) => analysis.cbaSummary.summary[l].netBenefit || 0) }],
        title: 'Net Benefit by Treatment',
        yLabel: 'RWF'
      })
    : null;

  const cbaRows = ['avgGrossRevenuePerPlot', 'avgTotalProductionCost', 'netBenefit', 'bcr', 'roi', 'avgYieldPerPlot', 'costPerKg'];
  const cbaRowLabels = {
    avgGrossRevenuePerPlot: 'Avg Gross Revenue',
    avgTotalProductionCost: 'Avg Total Production Cost',
    netBenefit: 'Net Benefit',
    bcr: 'Benefit-Cost Ratio',
    roi: 'ROI (%)',
    avgYieldPerPlot: 'Avg Yield (kg)',
    costPerKg: 'Cost per kg'
  };

  const csdCsiRows = labels.length
    ? [
        ['Cost Class', ...labels],
        ['C_SD', ...labels.map((l) => formatRWF(analysis.costStructure?.[l]?.csdCsi?.C_SD?.amount))],
        ['C_SI', ...labels.map((l) => formatRWF(analysis.costStructure?.[l]?.csdCsi?.C_SI?.amount))]
      ]
    : null;

  const yieldStats = analysis.descriptiveStats?.yield || {};
  const yieldAnova = analysis.anova?.yield;
  const breakEven = analysis.breakEven?.perTreatment || {};
  const sensitivity = analysis.sensitivity?.scenarios?.expected || {};

  const content = [
    coverBlock(title, `Design: ${trial.design} · Treatments: ${trial.numTreatments} · Replicates: ${trial.numReplicates} · Plot Size: ${trial.plotSizeM2} m²`),

    { text: 'Cost-Benefit Analysis Summary', style: 'subheader' },
    {
      table: {
        widths: ['*', ...labels.map(() => '*')],
        body: [
          ['Indicator', ...labels],
          ...cbaRows.map((key) => [
            cbaRowLabels[key],
            ...labels.map((l) => {
              const v = analysis.cbaSummary.summary[l][key];
              const currencyKeys = ['avgGrossRevenuePerPlot', 'avgTotalProductionCost', 'netBenefit', 'costPerKg'];
              return currencyKeys.includes(key) ? formatRWF(v) : v ?? '—';
            })
          ])
        ]
      },
      style: 'table',
      margin: [0, 0, 0, 12]
    }
  ];

  if (csdCsiRows) {
    content.push(
      { text: 'Cost Structure (C_SD / C_SI)', style: 'subheader' },
      { table: { widths: ['*', ...labels.map(() => '*')], body: csdCsiRows }, style: 'table', margin: [0, 0, 0, 12] }
    );
  }

  if (Object.keys(yieldStats).length) {
    content.push(
      { text: 'Descriptive Statistics — Yield', style: 'subheader' },
      {
        table: {
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            ['Treatment', 'n', 'Mean', 'SD', 'CV%', '95% CI'],
            ...Object.entries(yieldStats).map(([label, s]) => [
              label,
              String(s.n),
              String(s.mean),
              String(s.sd),
              `${s.cv}%`,
              `[${s.ci95?.lower}, ${s.ci95?.upper}]`
            ])
          ]
        },
        style: 'table',
        margin: [0, 0, 0, 12]
      }
    );
  }

  if (yieldAnova?.canCompute) {
    const anovaRows = [
      ['Source', 'SS', 'df', 'MS', 'F', 'p'],
      ['Treatment', yieldAnova.treatment.ss, yieldAnova.treatment.df, yieldAnova.treatment.ms, yieldAnova.treatment.f ?? '—', yieldAnova.treatment.p ?? '—']
    ];
    if (yieldAnova.block) {
      anovaRows.push(['Block', yieldAnova.block.ss, yieldAnova.block.df, yieldAnova.block.ms, yieldAnova.block.f ?? '—', yieldAnova.block.p ?? '—']);
    }
    anovaRows.push(['Error', yieldAnova.error.ss, yieldAnova.error.df, yieldAnova.error.ms, '—', '—']);
    content.push(
      { text: 'ANOVA — Yield', style: 'subheader' },
      {
        table: {
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: anovaRows
        },
        style: 'table',
        margin: [0, 0, 0, 4]
      },
      { text: `CV%: ${yieldAnova.cv} · LSD(α): ${yieldAnova.lsd}`, margin: [0, 0, 0, 4] },
      { text: yieldAnova.interpretation, italics: true, fontSize: 9, margin: [0, 0, 0, 12] }
    );
  }

  if (Object.keys(breakEven).length) {
    content.push(
      { text: 'Break-Even Analysis', style: 'subheader' },
      {
        table: {
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            ['Treatment', 'Break-even Yield (kg)', 'Yield Margin of Safety', 'Safety'],
            ...Object.entries(breakEven).map(([label, b]) => [
              label,
              String(b.breakEvenYieldPlot ?? '—'),
              typeof b.yieldMarginOfSafety === 'number' ? `${b.yieldMarginOfSafety}%` : '—',
              b.yieldSafetyClassification || '—'
            ])
          ]
        },
        style: 'table',
        margin: [0, 0, 0, 12]
      }
    );
  }

  if (Object.keys(sensitivity).length) {
    content.push(
      { text: 'Sensitivity — Expected Scenario', style: 'subheader' },
      {
        table: {
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            ['Treatment', 'Revenue', 'Cost', 'Gross Margin'],
            ...Object.entries(sensitivity).map(([label, s]) => [label, formatRWF(s.revenue), formatRWF(s.cost), formatRWF(s.grossMargin)])
          ]
        },
        style: 'table',
        margin: [0, 0, 0, 12]
      }
    );
  }

  if (yieldChartImage || netBenefitChartImage) {
    content.push({ text: 'Charts', style: 'subheader' });
    if (yieldChartImage) content.push({ image: yieldChartImage, width: 420, margin: [0, 4, 0, 10] });
    if (netBenefitChartImage) content.push({ image: netBenefitChartImage, width: 420 });
  }

  const docDefinition = {
    header: buildPdfHeader(title),
    footer: buildPdfFooter(),
    pageMargins: [40, 60, 40, 50],
    content,
    styles: BASE_STYLES
  };

  pdfMake.createPdf(docDefinition).download(`${title.replace(/[^\w]+/g, '_')}.pdf`);
}

/**
 * Farmer Mode Seasonal Report: Heading, Farm address, raw data tables
 * (Input Costs, Labour Costs, Yield & Revenue), CBA results, bar graphs —
 * all Python-rendered.
 */
export async function downloadFarmerSeasonalReport({ title, farmAddress, seasonLabel, inputCosts = [], laborCosts = [], yields = [], totals = {}, cba = {} }) {
  const [revenueVsCostImage, costSplitImage] = await Promise.all([
    renderChartImage({
      type: 'bar',
      labels: ['Revenue', 'Total Cost', 'Gross Margin'],
      series: [{ name: 'RWF', values: [totals.totalRevenue || 0, totals.totalCostOfProduction || 0, cba.grossMargin || 0] }],
      title: 'Revenue vs Cost vs Gross Margin',
      yLabel: 'RWF'
    }),
    renderChartImage({
      type: 'pie',
      labels: ['Input Costs', 'Labour Costs'],
      series: [{ name: 'RWF', values: [totals.inputCostTotal || 0, totals.laborCostTotal || 0] }],
      title: 'Cost of Production Breakdown'
    })
  ]);

  const docDefinition = {
    header: buildPdfHeader(title),
    footer: buildPdfFooter(),
    pageMargins: [40, 60, 40, 50],
    content: [
      coverBlock(title, `${farmAddress} · ${seasonLabel}`),

      { text: 'Input Costs', style: 'subheader' },
      {
        table: {
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            ['Date', 'Input', 'Unit', 'Unit Cost', 'Qty', 'Total'],
            ...inputCosts.map((c) => [fmtDate(c.date), c.inputName, c.unit, formatRWF(c.unitCost), String(c.quantity), formatRWF(c.totalCost)])
          ]
        },
        style: 'table'
      },
      { text: `Total Input Cost: ${formatRWF(totals.inputCostTotal)}`, margin: [0, 4, 0, 12], bold: true },

      { text: 'Labour Costs', style: 'subheader' },
      {
        table: {
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            ['Date', 'Activity', 'Time Taken', 'Unit', 'Wage Rate', 'Total'],
            ...laborCosts.map((l) => [fmtDate(l.date), l.activity, String(l.timeTaken), l.unit, formatRWF(l.wageRatePerDay), formatRWF(l.laborCost)])
          ]
        },
        style: 'table'
      },
      { text: `Total Labour Cost: ${formatRWF(totals.laborCostTotal)}`, margin: [0, 4, 0, 4], bold: true },
      { text: `Total Cost of Production: ${formatRWF(totals.totalCostOfProduction)}`, margin: [0, 0, 0, 12], bold: true },

      { text: 'Yield & Revenue', style: 'subheader' },
      {
        table: {
          widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            ['Date', 'Harvested (kg)', 'Sold (kg)', 'Remaining (kg)', 'Price (RWF/kg)', 'Revenue'],
            ...yields.map((y) => [fmtDate(y.date), y.yieldHarvested || '—', y.yieldSold || '—', y.remainingYield, y.marketPrice ? formatRWF(y.marketPrice) : '—', formatRWF(y.totalRevenue)])
          ]
        },
        style: 'table'
      },
      { text: `Total Revenue: ${formatRWF(totals.totalRevenue)}`, margin: [0, 4, 0, 12], bold: true },

      { text: 'CBA Results', style: 'subheader' },
      {
        table: {
          widths: ['*', '*'],
          body: [
            ['Gross Margin', formatRWF(cba.grossMargin)],
            ['ROI', typeof cba.roi === 'number' ? `${cba.roi.toFixed(1)}%` : '—'],
            ['Benefit-Cost Ratio (BCR)', typeof cba.bcr === 'number' ? cba.bcr.toFixed(2) : '—'],
            ['Cost of Production per kg', formatRWF(cba.costPerKg)],
            ['Break-even Yield (kg)', cba.breakEvenYield ?? '—'],
            ['Yield Margin of Safety', typeof cba.yieldMarginOfSafety === 'number' ? `${cba.yieldMarginOfSafety}%` : '—'],
            ['Adoption Cost', formatRWF(cba.adoptionCost)]
          ]
        },
        style: 'table',
        margin: [0, 0, 0, 12]
      },

      { text: 'Charts', style: 'subheader' },
      { image: revenueVsCostImage, width: 420, margin: [0, 4, 0, 10] },
      { image: costSplitImage, width: 320 }
    ],
    styles: BASE_STYLES
  };

  pdfMake.createPdf(docDefinition).download(`${title.replace(/\s+/g, '_')}.pdf`);
}
