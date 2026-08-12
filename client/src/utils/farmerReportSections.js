/**
 * Farmer Mode PDF section assembly.
 * Implements FarmEvidence_FarmerMode_Report_Spec.md Section 3 (report
 * sections) and Section 2 (Farmer-Mode-specific formatting overrides — its
 * own header/footer/styles, never the Researcher Mode template). Per the
 * spec's own implementation note, this is a separate, simpler template file,
 * not a stripped-down version of trialReportSections.js.
 */

import { buildSectionTitle, buildTable, buildInterpretationBlock, buildMetricCards, coverBlock, formatRWF, CA_COLOR, CF_COLOR, MUTED, BORDER, TEXT } from './pdf';
import {
  buildCostCategories,
  costCategoryInterpretation,
  seasonAtAGlanceSummary,
  interpretProfitabilityIndicator,
  whatThisMeansParagraph,
  seasonComparisonParagraph
} from './farmerModeInterpretation';
import { costCategoryChart, ownHistoryChart } from './farmerModeCharts';

/** The app's actual fixed treatment identity colours (design-tokens.css) — the spec's own
 * "canopy green for CA" assumption doesn't match what's actually assigned; using the real
 * ones keeps this report visually consistent with every other chart in the app. */
function systemColor(system) {
  return system === 'CF' ? CF_COLOR : CA_COLOR;
}

/** Section 2 — small-caps-style running header: farmer/plot name, season, system farmed. */
function buildFarmerPdfHeader({ farmerName, seasonLabel, system }) {
  const line = `${farmerName}   |   ${seasonLabel}   |   ${system}`.toUpperCase();
  return () => ({
    stack: [
      { text: line, style: 'farmerHeaderLine' },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.75, lineColor: BORDER }], margin: [0, 4, 0, 0] }
    ],
    margin: [40, 22, 40, 0]
  });
}

/** Section 2 — centered page number only, no other footer content. */
function buildFarmerPdfFooter() {
  return (currentPage) => ({ text: String(currentPage), alignment: 'center', style: 'farmerFooter', margin: [0, 6, 0, 0] });
}

// A function, not a module-level object literal: farmerReportSections.js and
// pdf.js import from each other (this file needs pdf.js's layout helpers;
// pdf.js needs buildFarmerReportContent), and pdf.js is always the one that
// starts the cycle. A top-level object literal referencing MUTED/TEXT here
// would dereference those `const` exports mid-evaluation of pdf.js, before
// it reaches their declarations — a real ReferenceError in webpack's spec-
// compliant ESM (Jest's Babel-CommonJS transform is lenient enough to hide
// it, which is why this only broke in the actual running app, not the tests).
function getFarmerStyles() {
  return {
    farmerHeaderLine: { fontSize: 7.5, bold: true, color: MUTED, characterSpacing: 1 },
    farmerFooter: { fontSize: 9, color: MUTED },
    farmerBody: { fontSize: 10, color: TEXT, lineHeight: 1.4, alignment: 'justify' }
  };
}

/** Section 3.1 — Cover. */
function buildCoverSection({ farmerName, system, crop, seasonLabel, location }) {
  const subtitleParts = [`Farming system: ${system}`, crop, location].filter(Boolean);
  return coverBlock(`${farmerName} — Seasonal Report`, subtitleParts.join(' · '), [seasonLabel]);
}

/** Section 3.2 — Season at a Glance. */
function buildGlanceSection({ harvestKg, crop, revenue, cost, profit, color }) {
  const summary = seasonAtAGlanceSummary({ harvestKg, crop, revenue, cost, profit });
  return [
    buildSectionTitle('Season at a Glance', '🌾'),
    buildMetricCards([
      { label: 'Total Yield (kg)', value: `${harvestKg.toFixed(1)} kg`, color },
      { label: 'Total Revenue', value: formatRWF(revenue), color },
      { label: 'Total Cost', value: formatRWF(cost), color },
      { label: 'Net Profit', value: formatRWF(profit), color }
    ]),
    { text: summary, style: 'farmerBody', margin: [0, 0, 0, 10] }
  ];
}

/** Section 3.3 — Where Your Money Went. */
function buildCostBreakdownSection({ inputCosts, laborCostTotal, color }) {
  const categories = buildCostCategories({ inputCosts, laborCostTotal });
  if (!categories.length) return [];
  const svg = costCategoryChart({ categories, color });
  const interpretation = costCategoryInterpretation(categories);
  return [
    buildSectionTitle('Where Your Money Went', '💰'),
    { svg, width: 460, margin: [0, 4, 0, 6] },
    buildInterpretationBlock(interpretation)
  ];
}

const INDICATOR_ROWS = [
  { key: 'netProfitPerPlot', label: 'Net Profit per plot' },
  { key: 'netProfitPerHa', label: 'Net Profit per hectare' },
  { key: 'bcr', label: 'Benefit-Cost Ratio' },
  { key: 'costPerKg', label: 'Cost per kg produced' },
  { key: 'breakEvenYield', label: 'Break-even yield' }
];

/** Section 3.4 — Profitability Indicators. */
function buildProfitabilityIndicatorsSection({ profit, profitPerHa, bcr, costPerKg, breakEvenYield, actualYield }) {
  const values = { netProfitPerPlot: profit, netProfitPerHa: profitPerHa, bcr, costPerKg, breakEvenYield };
  const displayValue = {
    netProfitPerPlot: formatRWF(profit),
    netProfitPerHa: typeof profitPerHa === 'number' ? formatRWF(profitPerHa) : null,
    bcr: typeof bcr === 'number' ? bcr.toFixed(2) : null,
    costPerKg: typeof costPerKg === 'number' ? `${formatRWF(costPerKg)}/kg` : null,
    breakEvenYield: typeof breakEvenYield === 'number' ? `${breakEvenYield.toFixed(1)} kg` : null
  };

  const rows = INDICATOR_ROWS.filter((row) => typeof values[row.key] === 'number' && displayValue[row.key] != null).map((row) => [
    row.label,
    displayValue[row.key],
    interpretProfitabilityIndicator(row.key, { value: values[row.key], actualYield, breakEvenYield })
  ]);
  if (!rows.length) return [];

  return [buildSectionTitle('Profitability Indicators', '📊'), buildTable(['Indicator', 'Value', 'What it means'], rows, ['auto', 'auto', '*'])];
}

/** Section 3.5 — How This Season Compares (own history only; omitted entirely when there's nothing to show). */
function buildSeasonComparisonSection({ system, profit, priorSeasons, cooperativeAvgProfit, color, currentSeasonLabel }) {
  const paragraph = seasonComparisonParagraph({ currentSystem: system, currentProfit: profit, priorSeasons, cooperativeAvgProfit });
  if (!paragraph) return [];

  let chartBlock = [];
  if (priorSeasons.length) {
    const chartSeasons = [...priorSeasons]
      .slice(0, 3)
      .reverse()
      .map((s) => ({ label: `Season ${s.season}`, value: s.profit, system: s.farmingSystem }));
    chartSeasons.push({ label: currentSeasonLabel, value: profit, system });
    const svg = ownHistoryChart({ seasons: chartSeasons, currentSystem: system, color });
    chartBlock = [{ svg, width: 460, margin: [0, 4, 0, 6] }];
  }

  return [buildSectionTitle('How This Season Compares', '📈'), ...chartBlock, buildInterpretationBlock(paragraph)];
}

/** Section 3.6 — What This Means for You. Never suggests switching farming system. */
function buildWhatThisMeansSection({ profit, currentItems, priorItems }) {
  const paragraphs = whatThisMeansParagraph({ profit, currentItems, priorItems });
  if (!paragraphs.length) return [];
  return [buildSectionTitle('What This Means for You', '💡'), ...paragraphs.map((p) => ({ text: p, style: 'farmerBody', margin: [0, 0, 0, 6] }))];
}

/** Section 3.7 — Your Season, in Detail (raw bookkeeping appendix). */
function buildDetailSection({ inputCosts, laborCosts, fmtDate }) {
  const rows = [
    ...inputCosts.map((c) => [fmtDate(c.date), c.inputName, 'Input', formatRWF(c.totalCost)]),
    ...laborCosts.map((l) => [fmtDate(l.date), l.activity, 'Labour', formatRWF(l.laborCost)])
  ].sort((a, b) => (a[0] > b[0] ? 1 : -1));
  if (!rows.length) return [];
  return [
    { text: '', pageBreak: 'before' },
    buildSectionTitle('Your Season, in Detail', '🧾'),
    buildTable(['Date', 'Activity/Input', 'Category', 'Cost'], rows, ['auto', '*', 'auto', 'auto'])
  ];
}

/**
 * Assembles the full Farmer Mode report — content array plus the
 * Farmer-Mode-specific header/footer/styles this docDefinition must use
 * instead of the shared Researcher Mode ones.
 */
export function buildFarmerReportContent({
  farmerName,
  system,
  crop,
  seasonLabel,
  location,
  harvestKg,
  revenue,
  cost,
  profit,
  profitPerHa,
  bcr,
  costPerKg,
  breakEvenYield,
  inputCosts = [],
  laborCosts = [],
  priorSeasons = [],
  cooperativeAvgProfit = null,
  fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
}) {
  const color = systemColor(system);
  const laborCostTotal = laborCosts.reduce((s, l) => s + (l.laborCost || 0), 0);
  const currentItems = buildCostCategories({ inputCosts, laborCostTotal });

  const content = [
    buildCoverSection({ farmerName, system, crop, seasonLabel, location }),
    ...buildGlanceSection({ harvestKg, crop, revenue, cost, profit, color }),
    ...buildCostBreakdownSection({ inputCosts, laborCostTotal, color }),
    ...buildProfitabilityIndicatorsSection({ profit, profitPerHa, bcr, costPerKg, breakEvenYield, actualYield: harvestKg }),
    ...buildSeasonComparisonSection({ system, profit, priorSeasons, cooperativeAvgProfit, color, currentSeasonLabel: seasonLabel }),
    ...buildWhatThisMeansSection({ profit, currentItems, priorItems: null }),
    ...buildDetailSection({ inputCosts, laborCosts, fmtDate })
  ];

  return { content: content.filter(Boolean), header: buildFarmerPdfHeader({ farmerName, seasonLabel, system }), footer: buildFarmerPdfFooter(), styles: getFarmerStyles() };
}
