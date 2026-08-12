/**
 * Trial Mode (Researcher Mode) PDF section assembly.
 * Implements FarmEvidence_TrialMode_Report_Spec.md Section 1 (report
 * structure) and Section 2 (table conventions), wiring the pure
 * interpretation functions (./trialModeInterpretation) and vector chart
 * builders (./trialModeCharts) into pdfmake content nodes. Returns a plain
 * content array — no pdfMake instance touched here — so section presence,
 * numbers, and omission rules are assertable without rendering a PDF.
 */

import { buildSectionTitle, buildTable, buildInterpretationBlock, coverBlock, formatRWF } from './pdf';
import {
  formatThousands,
  formatSignedPercent,
  percentDifference,
  indicatorSuperiority,
  costLineTag,
  interpretResultsTable,
  rankCostDrivers,
  mechanismParagraph,
  interpretStatisticalResult,
  synthesisText,
  conclusiveResultStatement,
  anomalyStatements,
  sensitivityRobustnessStatement,
  blockEffectStatement,
  descriptiveStatsFootnote
} from './trialModeInterpretation';
import { groupedBarChart, smallMultipleBarChart, waterfallChart, treatmentSeries, buildChartCaption } from './trialModeCharts';

const VARIABLE_META = {
  yield: { label: 'Yield', unit: 'kg/plot', dp: 2 },
  grossRevenue: { label: 'Gross Revenue', unit: 'RWF/plot', dp: 0 },
  totalProductionCost: { label: 'Total Production Cost', unit: 'RWF/plot', dp: 0 },
  cSD: { label: 'System-Dependent Cost (C_SD)', unit: 'RWF/plot', dp: 0 },
  cSI: { label: 'System-Independent Cost (C_SI)', unit: 'RWF/plot', dp: 0 },
  netBenefit: { label: 'Net Benefit', unit: 'RWF/plot', dp: 0 },
  labourTime: { label: 'Labour Time', unit: 'minutes/plot', dp: 1 },
  labourCost: { label: 'Labour Cost', unit: 'RWF/plot', dp: 0 }
};

/** Prefers the app-wide CA-then-CF convention; falls back to whatever order the data has for non-CA/CF trials. */
function orderedCodes(labels) {
  const preferred = ['CA', 'CF'].filter((code) => labels.includes(code));
  if (preferred.length === labels.length) return preferred;
  return labels;
}

function tableCaption(n, description, note) {
  return `Table ${n}. ${description}${note ? ` ${note}` : ''}`;
}

function groupPlotsByCodeAndReplicate(plots, treatmentIdToCode) {
  const grouped = {};
  for (const plot of plots || []) {
    const code = treatmentIdToCode[String(plot.treatmentId)];
    if (!code) continue;
    if (!grouped[code]) grouped[code] = {};
    grouped[code][plot.replicateNumber] = plot;
  }
  return grouped;
}

function replicateNumbers(groupedPlots, codes) {
  const set = new Set();
  codes.forEach((code) => Object.keys(groupedPlots[code] || {}).forEach((rep) => set.add(Number(rep))));
  return [...set].sort((a, b) => a - b);
}

/** Section 1 item 1 — Cover. */
function buildCoverSection({ trial, setup, season, seasonLabel }) {
  const title = `${trial.crop}${trial.variety ? ` (${trial.variety})` : ''} — Trial Analysis Report`;
  const subtitle = [setup?.name, trial.site || trial.district, seasonLabel || season?.seasonLabel].filter(Boolean).join(' · ');
  return coverBlock(title, subtitle, [
    `Design: ${trial.design}, ${trial.numTreatments} treatments × ${trial.numReplicates} replicates`,
    `Plot size: ${trial.plotSizeM2} m²`,
    'Researcher mode · Trial closure report'
  ]);
}

/** Section 1 item 2 — auto-generated SMART-objective trial summary paragraph. */
function buildTrialSummarySection({ trial, treatmentA, treatmentB, testedVariables }) {
  const variableNames = testedVariables.map((v) => VARIABLE_META[v]?.label || v).join(', ');
  const text =
    `This trial established an empirical comparison of ${treatmentA} vs ${treatmentB} in a ${trial.design} design ` +
    `with ${trial.numReplicates} replicates per treatment, as measured by ${variableNames}, reported in the tables and figures below.`;
  return [buildSectionTitle('Trial Summary', '📋'), { text, style: 'body', margin: [0, 0, 0, 10] }];
}

/** Section 1 item 3 + Section 2 conventions — Net Differential Summary. */
function buildNetDifferentialSection({ cbaSummary, treatmentA, treatmentB, extrapolationFactor, groupedPlots, numReplicates, tableN, figureN, costLines }) {
  const rows = [
    { key: 'avgYieldPerPlot', haKey: 'avgYieldPerHa', label: 'Yield', unit: 'kg', higherIsBetter: true },
    { key: 'avgGrossRevenuePerPlot', haKey: 'avgGrossRevenuePerHa', label: 'Gross Revenue', unit: 'RWF', higherIsBetter: true },
    { key: 'avgCSD', label: 'Total C_SD', unit: 'RWF', higherIsBetter: false },
    { key: 'avgCSI', label: 'Total C_SI', unit: 'RWF', higherIsBetter: false },
    { key: 'avgTotalProductionCost', label: 'Total Production Cost', unit: 'RWF', higherIsBetter: false },
    { key: 'netBenefit', label: 'Net Benefit', unit: 'RWF', higherIsBetter: true }
  ];

  const a = cbaSummary.summary[treatmentA];
  const b = cbaSummary.summary[treatmentB];
  const tableRows = [];

  rows.forEach((row) => {
    const meanA = a[row.key];
    const meanB = b[row.key];
    const diff = meanA - meanB;
    const pct = percentDifference(meanA, meanB);
    const { label: superiorLabel } = indicatorSuperiority({ treatmentA, treatmentB, meanA, meanB, higherIsBetter: row.higherIsBetter });
    tableRows.push([
      `${row.label} (plot)`,
      formatThousands(meanA, row.unit === 'kg' ? 2 : 0),
      formatThousands(meanB, row.unit === 'kg' ? 2 : 0),
      formatThousands(diff, row.unit === 'kg' ? 2 : 0),
      pct !== null ? formatSignedPercent(pct) : '—',
      superiorLabel
    ]);

    const haMeanA = row.haKey ? a[row.haKey] : extrapolationFactor ? meanA * extrapolationFactor : null;
    const haMeanB = row.haKey ? b[row.haKey] : extrapolationFactor ? meanB * extrapolationFactor : null;
    if (typeof haMeanA === 'number' && typeof haMeanB === 'number') {
      const haDiff = haMeanA - haMeanB;
      const haPct = percentDifference(haMeanA, haMeanB);
      const { label: haSuperiorLabel } = indicatorSuperiority({ treatmentA, treatmentB, meanA: haMeanA, meanB: haMeanB, higherIsBetter: row.higherIsBetter });
      tableRows.push([
        `${row.label} (per ha)`,
        formatThousands(haMeanA, 0),
        formatThousands(haMeanB, 0),
        formatThousands(haDiff, 0),
        haPct !== null ? formatSignedPercent(haPct) : '—',
        haSuperiorLabel
      ]);
    }
  });

  const table = buildTable(['Indicator', treatmentA, treatmentB, 'Difference', '% Difference', 'Superior System'], tableRows, ['*', 'auto', 'auto', 'auto', 'auto', 'auto']);
  const caption = { text: tableCaption(tableN, 'Net Differential Summary.', `Means across n = ${numReplicates} replicates per treatment.`), style: 'caption' };

  const codes = [treatmentA, treatmentB];
  const reps = replicateNumbers(groupedPlots, codes);
  const chartData = reps.map((rep) => ({
    label: `Rep ${rep}`,
    values: { [treatmentA]: groupedPlots[treatmentA]?.[rep]?.netBenefit ?? 0, [treatmentB]: groupedPlots[treatmentB]?.[rep]?.netBenefit ?? 0 }
  }));
  const svg = groupedBarChart({
    data: chartData,
    series: treatmentSeries([treatmentA, treatmentB]),
    unit: 'RWF/plot',
    referenceLines: { [treatmentA]: a.netBenefit, [treatmentB]: b.netBenefit }
  });

  const netBenefitInterp = interpretResultsTable({
    metricLabel: 'Net Benefit',
    unit: 'RWF/plot',
    treatmentA,
    treatmentB,
    meanA: a.netBenefit,
    meanB: b.netBenefit,
    dp: 0,
    costDriverLabel: costLines.length ? rankCostDrivers(costLines)[0]?.label : null,
    soWhat: 'This addresses the trial\'s core profitability comparison between the two systems.'
  });

  return [
    buildSectionTitle('Net Differential Summary', '📊'),
    table,
    caption,
    { svg, width: 480, margin: [0, 4, 0, 2] },
    { text: buildChartCaption(figureN, `Net Benefit by replicate, both treatments, with each treatment's overall mean shown as a dashed reference line.`), style: 'caption' },
    buildInterpretationBlock(netBenefitInterp)
  ];
}

/** Section 1 item 4 — CBA Indicators table + Gross Margin chart + BCR/ROI/Cost-per-kg small multiple. */
function buildCbaIndicatorsSection({ cbaSummary, breakEven, descriptiveStats, treatmentA, treatmentB, extrapolationFactor, groupedPlots, tableN, figureNGM, figureNRatios }) {
  const a = cbaSummary.summary[treatmentA];
  const b = cbaSummary.summary[treatmentB];
  const beA = breakEven?.perTreatment?.[treatmentA];
  const beB = breakEven?.perTreatment?.[treatmentB];
  const labourTimeA = descriptiveStats?.labourTime?.[treatmentA]?.mean;
  const labourTimeB = descriptiveStats?.labourTime?.[treatmentB]?.mean;
  const labourCostA = descriptiveStats?.labourCost?.[treatmentA]?.mean;
  const labourCostB = descriptiveStats?.labourCost?.[treatmentB]?.mean;

  const indicatorRows = [
    { label: 'Gross Margin (plot)', meanA: a.netBenefit, meanB: b.netBenefit, unit: 'RWF', higherIsBetter: true, dp: 0 },
    extrapolationFactor
      ? { label: 'Gross Margin (per ha)', meanA: a.netBenefit * extrapolationFactor, meanB: b.netBenefit * extrapolationFactor, unit: 'RWF', higherIsBetter: true, dp: 0 }
      : null,
    { label: 'Adjusted Gross Margin', meanA: a.adjustedGrossMargin, meanB: b.adjustedGrossMargin, unit: 'RWF', higherIsBetter: true, dp: 0 },
    { label: 'Benefit-Cost Ratio (BCR)', meanA: a.bcr, meanB: b.bcr, unit: '', higherIsBetter: true, dp: 2 },
    { label: 'ROI', meanA: a.roi, meanB: b.roi, unit: '%', higherIsBetter: true, dp: 1 },
    { label: 'Cost of Production per kg', meanA: a.costPerKg, meanB: b.costPerKg, unit: 'RWF', higherIsBetter: false, dp: 0 },
    beA && beB ? { label: 'Break-Even Yield', meanA: beA.breakEvenYieldPlot, meanB: beB.breakEvenYieldPlot, unit: 'kg', higherIsBetter: false, dp: 2 } : null,
    beA && beB ? { label: 'Yield Margin of Safety', meanA: beA.yieldMarginOfSafety, meanB: beB.yieldMarginOfSafety, unit: '%', higherIsBetter: true, dp: 1 } : null,
    typeof labourTimeA === 'number' && typeof labourTimeB === 'number' ? { label: 'Labour Time', meanA: labourTimeA, meanB: labourTimeB, unit: 'min', higherIsBetter: false, dp: 1 } : null,
    typeof labourCostA === 'number' && typeof labourCostB === 'number' ? { label: 'Labour Cost', meanA: labourCostA, meanB: labourCostB, unit: 'RWF', higherIsBetter: false, dp: 0 } : null
  ].filter(Boolean);

  const tableRows = indicatorRows.map((row) => {
    const diff = row.meanA - row.meanB;
    const pct = percentDifference(row.meanA, row.meanB);
    const { label: superiorLabel } = indicatorSuperiority({ treatmentA, treatmentB, meanA: row.meanA, meanB: row.meanB, higherIsBetter: row.higherIsBetter });
    return [
      `${row.label}${row.unit ? ` (${row.unit})` : ''}`,
      formatThousands(row.meanA, row.dp),
      formatThousands(row.meanB, row.dp),
      formatThousands(diff, row.dp),
      pct !== null ? formatSignedPercent(pct) : '—',
      superiorLabel
    ];
  });

  const table = buildTable(['Indicator', treatmentA, treatmentB, 'Difference', '% Difference', 'Superior System'], tableRows, ['*', 'auto', 'auto', 'auto', 'auto', 'auto']);
  const caption = { text: tableCaption(tableN, 'CBA Indicators.', 'Break-Even Yield and BCR can favor different treatments — each row is flagged independently.'), style: 'caption' };

  const reps = replicateNumbers(groupedPlots, [treatmentA, treatmentB]);
  const gmChartData = reps.map((rep) => ({
    label: `Rep ${rep}`,
    values: { [treatmentA]: groupedPlots[treatmentA]?.[rep]?.netBenefit ?? 0, [treatmentB]: groupedPlots[treatmentB]?.[rep]?.netBenefit ?? 0 }
  }));
  const gmSvg = groupedBarChart({ data: gmChartData, series: treatmentSeries([treatmentA, treatmentB]), unit: 'RWF/plot' });

  const ratiosSvg = smallMultipleBarChart({
    series: treatmentSeries([treatmentA, treatmentB]),
    panels: [
      { title: 'BCR', data: [{ label: '', values: { [treatmentA]: a.bcr, [treatmentB]: b.bcr } }], dp: 2 },
      { title: 'ROI (%)', data: [{ label: '', values: { [treatmentA]: a.roi, [treatmentB]: b.roi } }], unit: '%', dp: 1 },
      { title: 'Cost per kg (RWF)', data: [{ label: '', values: { [treatmentA]: a.costPerKg, [treatmentB]: b.costPerKg } }], unit: 'RWF/kg', dp: 0 }
    ]
  });

  const interp = interpretResultsTable({
    metricLabel: 'Gross Margin',
    unit: 'RWF/plot',
    treatmentA,
    treatmentB,
    meanA: a.netBenefit,
    meanB: b.netBenefit,
    dp: 0,
    soWhat: 'BCR and Break-Even Yield are read alongside Gross Margin since a system can lead on profitability while trailing on cost-recovery risk, or vice versa.'
  });

  return [
    buildSectionTitle('CBA Indicators', '💹'),
    table,
    caption,
    { svg: gmSvg, width: 480, margin: [0, 4, 0, 2] },
    { text: buildChartCaption(figureNGM, 'Gross Margin by replicate, both treatments.'), style: 'caption' },
    { svg: ratiosSvg, width: 480, margin: [0, 4, 0, 2] },
    { text: buildChartCaption(figureNRatios, 'BCR, ROI, and Cost per kg, shown as independent-axis small multiples.'), style: 'caption' },
    buildInterpretationBlock(interp)
  ];
}

/** Section 1 item 5 — Cost Structure Decomposition (C_SD / C_SI). */
function buildCostStructureSection({ costStructure, treatmentA, treatmentB, tableN, figureN }) {
  const componentsA = costStructure[treatmentA]?.components || {};
  const componentsB = costStructure[treatmentB]?.components || {};
  const names = [...new Set([...Object.keys(componentsA), ...Object.keys(componentsB)])];
  if (!names.length) return [];

  const costLines = names.map((name) => {
    const itemA = componentsA[name];
    const itemB = componentsB[name];
    const meanA = itemA?.amount ?? 0;
    const meanB = itemB?.amount ?? 0;
    const costType = itemA?.costType || itemB?.costType || null;
    const tag = costLineTag({ existsForA: Boolean(itemA), existsForB: Boolean(itemB), meanA, meanB, treatmentA, treatmentB });
    return { label: name, meanA, meanB, costType, tag };
  });

  const tableRows = costLines.map((line) => [line.label, line.costType || '—', formatThousands(line.meanA, 0), formatThousands(line.meanB, 0), formatThousands(line.meanA - line.meanB, 0), line.tag]);
  const table = buildTable(['Cost Line Item', 'Class', treatmentA, treatmentB, 'Difference', 'Tag'], tableRows, ['*', 'auto', 'auto', 'auto', 'auto', 'auto']);
  const caption = { text: tableCaption(tableN, 'Cost Structure Decomposition (C_SD / C_SI).'), style: 'caption' };

  const csdLines = costLines.filter((l) => l.costType === 'C_SD').sort((a, b) => Math.abs(b.meanA - b.meanB) - Math.abs(a.meanA - a.meanB));
  let chartBlock = [];
  if (csdLines.length) {
    const svg = groupedBarChart({
      data: csdLines.map((l) => ({ label: l.label, values: { [treatmentA]: l.meanA, [treatmentB]: l.meanB } })),
      series: treatmentSeries([treatmentA, treatmentB]),
      unit: 'RWF/plot'
    });
    chartBlock = [{ svg, width: 480, margin: [0, 4, 0, 2] }, { text: buildChartCaption(figureN, 'System-dependent (C_SD) cost components only — C_SI components are standardised across treatments and omitted as uninformative.'), style: 'caption' }];
  }

  const interp = mechanismParagraph({ costLines, treatmentA, treatmentB, unit: 'RWF/plot' });

  return [buildSectionTitle('Cost Structure', '🧾'), table, caption, ...chartBlock, buildInterpretationBlock(interp)];
}

/** Section 1 item 6 — Raw Data by Replicate, one sub-table per tested variable. */
function buildRawDataSection({ testedVariables, descriptiveStats, groupedPlots, treatmentA, treatmentB, tableN }) {
  const codes = [treatmentA, treatmentB];
  const reps = replicateNumbers(groupedPlots, codes);
  if (!reps.length) return [];

  const content = [buildSectionTitle('Raw Data by Replicate', '📄')];
  testedVariables.forEach((variable) => {
    const meta = VARIABLE_META[variable];
    const valueOf = (code, rep) => rawVariableValue(groupedPlots[code]?.[rep], variable);
    const rows = reps.map((rep) => {
      const valA = valueOf(treatmentA, rep);
      const valB = valueOf(treatmentB, rep);
      const diff = typeof valA === 'number' && typeof valB === 'number' ? valA - valB : null;
      return [`Rep ${rep}`, formatThousands(valA, meta.dp), formatThousands(valB, meta.dp), diff !== null ? formatThousands(diff, meta.dp) : '—'];
    });
    const statA = descriptiveStats?.[variable]?.[treatmentA];
    const statB = descriptiveStats?.[variable]?.[treatmentB];
    if (statA) rows.push([`${treatmentA} — Mean ± SD`, `${formatThousands(statA.mean, meta.dp)} ± ${formatThousands(statA.sd, meta.dp)}`, '—', '—']);
    if (statB) rows.push([`${treatmentB} — Mean ± SD`, '—', `${formatThousands(statB.mean, meta.dp)} ± ${formatThousands(statB.sd, meta.dp)}`, '—']);

    content.push(buildTable(['Replicate', treatmentA, treatmentB, 'Difference'], rows, ['*', 'auto', 'auto', 'auto']));
    content.push({ text: tableCaption(tableN, `Raw Data by Replicate — ${meta.label} (${meta.unit}).`), style: 'caption' });
  });

  return content;
}

function rawVariableValue(plot, variable) {
  if (!plot) return null;
  const fieldMap = { yield: 'yieldKg', grossRevenue: 'grossRevenueRwf', totalProductionCost: 'totalProductionCost', cSD: 'cSDTotal', cSI: 'cSITotal', netBenefit: 'netBenefit', labourTime: 'subtotalLabourTimeMin', labourCost: 'subtotalLabourCosts' };
  const field = fieldMap[variable];
  return field ? plot[field] : null;
}

/** Section 1 item 7 — Descriptive Statistics per variable. */
function buildDescriptiveStatsSection({ testedVariables, descriptiveStats, treatmentA, treatmentB, trialConfig, tableN }) {
  const rows = [];
  testedVariables.forEach((variable) => {
    [treatmentA, treatmentB].forEach((code) => {
      const s = descriptiveStats?.[variable]?.[code];
      if (!s) return;
      rows.push([VARIABLE_META[variable]?.label || variable, code, String(s.n), formatThousands(s.mean, 2), formatThousands(s.sd, 2), formatThousands(s.se, 2), `${formatThousands(s.ci95?.lower, 2)} to ${formatThousands(s.ci95?.upper, 2)}`, `${formatThousands(s.cv, 1)}%`]);
    });
  });
  if (!rows.length) return [];

  const table = buildTable(['Variable', 'Treatment', 'n', 'Mean', 'SD', 'SE', '95% CI', 'CV%'], rows, ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto']);
  const footnote = typeof trialConfig?.tCritical === 'number' && typeof trialConfig?.dfError === 'number'
    ? descriptiveStatsFootnote({ tCritical: trialConfig.tCritical, df: trialConfig.dfError })
    : null;

  return [
    buildSectionTitle('Descriptive Statistics', '📐'),
    table,
    { text: [tableCaption(tableN, 'Descriptive Statistics per treatment per variable.'), footnote ? ` ${footnote}` : ''].join(''), style: 'caption' }
  ];
}

/** Section 1 item 8 — ANOVA tables + consolidated hypothesis decisions. */
function buildAnovaSection({ testedVariables, anova, tTest, treatmentA, treatmentB, tableNStart }) {
  const content = [buildSectionTitle('ANOVA & Hypothesis Tests', '🔬')];
  const hypothesisRows = [];
  let tableN = tableNStart;

  testedVariables.forEach((variable) => {
    const result = anova?.[variable];
    if (!result?.canCompute) return;
    const meta = VARIABLE_META[variable];

    const anovaRows = [['Treatment', formatThousands(result.treatment.ss, 2), String(result.treatment.df), formatThousands(result.treatment.ms, 2), result.treatment.f != null ? formatThousands(result.treatment.f, 2) : '—', result.treatment.p != null ? formatThousands(result.treatment.p, 4) : '—', result.treatment.significant ? 'REJECT H0' : 'FAIL TO REJECT H0']];
    anovaRows.push(['Error', formatThousands(result.error.ss, 2), String(result.error.df), formatThousands(result.error.ms, 2), '—', '—', '—']);
    anovaRows.push(['Total', formatThousands(result.total.ss, 2), String(result.total.df), '—', '—', '—', '—']);

    content.push(buildTable(['Source of Variation', 'SS', 'df', 'MS', 'F', 'p', 'Decision'], anovaRows, ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto']));
    content.push({ text: tableCaption(tableN, `ANOVA — ${meta.label}.`, `CV% = ${formatThousands(result.cv, 2)}, LSD (α=0.05) = ${formatThousands(result.lsd, 2)}.`), style: 'caption' });
    tableN += 1;

    const t = tTest?.[variable];
    if (t?.canCompute) {
      const stats = anova[variable];
      hypothesisRows.push([
        `H0: μ(${treatmentA}) = μ(${treatmentB})`,
        meta.label,
        formatThousands(t.tStat, 2),
        String(t.df),
        formatThousands(t.pValue, 4),
        `${formatThousands(t.ci95?.lower, 2)} to ${formatThousands(t.ci95?.upper, 2)}`,
        t.significant ? 'REJECT H0' : 'FAIL TO REJECT H0',
        interpretStatisticalResult({
          metricLabel: meta.label,
          unit: meta.unit,
          treatmentA,
          treatmentB,
          meanA: stats.treatmentMeans[treatmentA],
          meanB: stats.treatmentMeans[treatmentB],
          dp: meta.dp,
          tStat: t.tStat,
          df: t.df,
          pValue: t.pValue,
          significant: t.significant,
          ci95: t.ci95,
          lsd: stats.lsd,
          n: stats.error.df / 2 + 1 // error.df = 2n-2 for 2 treatments with n replicates each
        })
      ]);
    }
  });

  if (hypothesisRows.length) {
    content.push(buildSectionTitle('Consolidated Hypothesis Decisions', ''));
    content.push(buildTable(['Hypothesis', 'Variable', 't', 'df', 'p', '95% CI', 'Decision', 'Interpretation'], hypothesisRows, ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', '*']));
    content.push({ text: tableCaption(tableN, 'Consolidated Hypothesis Decisions across all tested variables.'), style: 'caption' });
    tableN += 1;
  }

  return { content, nextTableN: tableN, hypothesisRows };
}

/** Section 1 item 9 — RCBD Block Analysis (only when design is RCBD with >=3 blocks). */
function buildRcbdBlockSection({ trial, rcbdBlockAnalysis, tableN }) {
  if (trial.design !== 'RCBD' || trial.numReplicates < 3 || !rcbdBlockAnalysis) return { content: [] };
  const yieldBlock = rcbdBlockAnalysis.yield;
  if (!yieldBlock?.canCompute) return { content: [] };

  const rows = yieldBlock.blockEffects.map((be, i) => [
    `Block ${be.block}`,
    formatThousands(yieldBlock.blockMeans[i], 2),
    formatThousands(be.effect, 2),
    be.effect >= 0 ? 'Above grand mean' : 'Below grand mean'
  ]);
  const table = buildTable(['Block', 'Block Mean', 'Block Effect', 'Direction'], rows, ['auto', 'auto', 'auto', '*']);
  const caption = { text: tableCaption(tableN, 'RCBD Block Analysis — Yield.', `Grand mean = ${formatThousands(yieldBlock.grandMean, 2)} kg/plot.`), style: 'caption' };
  const statement = blockEffectStatement({ significant: yieldBlock.block.significant, fValue: yieldBlock.block.f, pValue: yieldBlock.block.p });

  return { content: [buildSectionTitle('RCBD Block Analysis', '🧱'), table, caption, buildInterpretationBlock(statement)] };
}

/**
 * Results Discussion building block #4 — detects any replicate whose
 * per-block Net Benefit comparison reverses the trial's overall favored
 * treatment. Uses the raw per-replicate values (groupedPlots), not the RCBD
 * block-effect table, since block effects are aggregate-across-treatments
 * and don't carry a per-block winner.
 */
function computeBlockAnomalies({ groupedPlots, treatmentA, treatmentB, overallFavors }) {
  const reps = replicateNumbers(groupedPlots, [treatmentA, treatmentB]);
  const blocks = reps
    .map((rep) => {
      const valA = groupedPlots[treatmentA]?.[rep]?.netBenefit;
      const valB = groupedPlots[treatmentB]?.[rep]?.netBenefit;
      if (typeof valA !== 'number' || typeof valB !== 'number') return null;
      return { label: `Replicate ${rep}`, favors: valA >= valB ? treatmentA : treatmentB };
    })
    .filter(Boolean);
  return anomalyStatements({ overallFavors, blocks, treatmentA, treatmentB });
}

/** Section 1 item 10 — Yield/Outcome Stability and Sensitivity Analysis. */
function buildStabilitySection({ riskStability, sensitivity, treatmentA, treatmentB, breakEven, tableN, figureN }) {
  const yieldRisk = riskStability?.yield?.perTreatment;
  if (!yieldRisk) return { content: [], favoredTreatment: null, scenarioWinners: null };

  const rows = [treatmentA, treatmentB].map((code) => {
    const r = yieldRisk[code];
    const be = breakEven?.perTreatment?.[code];
    return [code, formatThousands(r.sd, 2), `${formatThousands(r.cv, 1)}%`, formatThousands(r.range, 2), be ? formatThousands(be.breakEvenYieldPlot, 2) : '—', be ? `${formatThousands(be.yieldMarginOfSafety, 1)}%` : '—'];
  });
  const table = buildTable(['Treatment', 'SD', 'CV%', 'Range', 'Break-Even Yield', 'Margin of Safety'], rows, ['auto', 'auto', 'auto', 'auto', 'auto', 'auto']);
  const caption = { text: tableCaption(tableN, 'Yield Stability and Sensitivity Analysis.'), style: 'caption' };

  let chartBlock = [];
  let favoredTreatment = null;
  let scenarioWinners = null;
  if (sensitivity?.scenarios) {
    const scenarioOrder = ['pessimistic', 'expected', 'optimistic'].filter((s) => sensitivity.scenarios[s]);
    const chartData = scenarioOrder.map((scenario) => ({
      label: scenario.charAt(0).toUpperCase() + scenario.slice(1),
      values: { [treatmentA]: sensitivity.scenarios[scenario][treatmentA]?.grossMargin ?? 0, [treatmentB]: sensitivity.scenarios[scenario][treatmentB]?.grossMargin ?? 0 }
    }));
    const svg = groupedBarChart({ data: chartData, series: treatmentSeries([treatmentA, treatmentB]), unit: 'RWF/plot' });
    chartBlock = [{ svg, width: 480, margin: [0, 4, 0, 2] }, { text: buildChartCaption(figureN, 'Gross Margin under pessimistic, expected, and optimistic price/wage scenarios.'), style: 'caption' }];

    scenarioWinners = sensitivity.winnerMatrix;
    favoredTreatment = sensitivity.winnerMatrix.expected;
  }

  return {
    content: [buildSectionTitle('Yield Stability & Sensitivity Analysis', '📉'), table, caption, ...chartBlock],
    favoredTreatment,
    scenarioWinners
  };
}

/** Section 1 item 11 — Partial Budget Analysis (only when the caller supplies a baseline/alternative comparison). */
function buildPartialBudgetSection({ partialBudget, treatmentA, treatmentB, tableN, figureN }) {
  if (!partialBudget) return [];

  const rows = [
    ...partialBudget.benefitLines.map((l) => ['Additional Benefit', l.item, formatThousands(l.amount, 0)]),
    ...partialBudget.costLines.map((l) => ['Additional Cost', l.item, formatThousands(l.amount, 0)]),
    ['Net Change', '—', formatThousands(partialBudget.netChange, 0)]
  ];
  const table = buildTable(['Type', 'Item', 'Amount (RWF/plot)'], rows, ['auto', '*', 'auto']);
  const caption = { text: tableCaption(tableN, 'Partial Budget Analysis.'), style: 'caption' };

  const svg = waterfallChart({
    treatments: [
      { key: treatmentA, label: treatmentA, values: { grossRevenue: partialBudget.additionalBenefits, totalProductionCost: partialBudget.additionalCosts, netBenefit: partialBudget.netChange } }
    ],
    unit: 'RWF/plot'
  });

  return [
    buildSectionTitle('Partial Budget Analysis', '🧮'),
    table,
    caption,
    { svg, width: 480, margin: [0, 4, 0, 2] },
    { text: buildChartCaption(figureN, 'Partial budget waterfall: additional benefits, additional costs, and net change.'), style: 'caption' },
    buildInterpretationBlock(partialBudget.recommendation)
  ];
}

/** Section 1 item 12 — Results Discussion (prose synthesis, per spec Section 3.3). */
function buildResultsDiscussionSection({ hypothesisRows, treatmentA, treatmentB, costLines, groupedPlots, favoredTreatment, scenarioWinners, cbaSummary }) {
  const overallFavors = cbaSummary.summary[treatmentA].netBenefit >= cbaSummary.summary[treatmentB].netBenefit ? treatmentA : treatmentB;
  const metrics = [
    { name: 'Yield', favors: cbaSummary.summary[treatmentA].avgYieldPerPlot >= cbaSummary.summary[treatmentB].avgYieldPerPlot ? treatmentA : treatmentB },
    { name: 'Net Benefit', favors: overallFavors },
    { name: 'BCR', favors: cbaSummary.summary[treatmentA].bcr >= cbaSummary.summary[treatmentB].bcr ? treatmentA : treatmentB },
    { name: 'ROI', favors: cbaSummary.summary[treatmentA].roi >= cbaSummary.summary[treatmentB].roi ? treatmentA : treatmentB },
    { name: 'Cost per kg', favors: cbaSummary.summary[treatmentA].costPerKg <= cbaSummary.summary[treatmentB].costPerKg ? treatmentA : treatmentB }
  ];

  const paragraphs = [];
  const synthesis = synthesisText(metrics);
  if (synthesis) paragraphs.push(synthesis);

  const mechanism = mechanismParagraph({ costLines, treatmentA, treatmentB, unit: 'RWF/plot' });
  if (mechanism) paragraphs.push(mechanism);

  const significantVars = hypothesisRows.filter((r) => r[6] === 'REJECT H0');
  if (significantVars.length === 1) {
    const conclusive = conclusiveResultStatement({
      variables: [{ name: significantVars[0][1], pValue: Number(significantVars[0][4]), favors: treatmentA }]
    });
    if (conclusive) paragraphs.push(conclusive);
  }

  computeBlockAnomalies({ groupedPlots, treatmentA, treatmentB, overallFavors }).forEach((a) => paragraphs.push(a));

  if (favoredTreatment && scenarioWinners) {
    const robustness = sensitivityRobustnessStatement({ favoredTreatment, scenarios: scenarioWinners });
    if (robustness) paragraphs.push(robustness);
  }

  if (!paragraphs.length) return [];

  return [buildSectionTitle('Results Discussion', '🗣️'), ...paragraphs.map((p) => ({ text: p, style: 'body', margin: [0, 0, 0, 8] }))];
}

/** Section 1 item 13 — Limitations, auto-generated from trial metadata. */
function buildLimitationsSection({ trial, plots }) {
  const notes = [];
  if (trial.numReplicates < 5) {
    notes.push(`This trial ran with ${trial.numReplicates} replicates per treatment, which limits statistical power to detect smaller true effects.`);
  }
  notes.push('This report reflects a single season of recorded data — treatment rankings should be confirmed across additional seasons before being treated as conclusive.');
  const missing = (plots || []).filter((p) => p.yieldKg == null || p.totalProductionCost == null);
  if (missing.length) {
    notes.push(`${missing.length} plot(s) are missing a recorded yield or cost entry and were excluded from the relevant calculations.`);
  }
  return [buildSectionTitle('Limitations', '⚠️'), ...notes.map((n) => ({ text: n, style: 'body', margin: [0, 0, 0, 6] }))];
}

/** Section 1 item 14 — Appendix: Full Raw Plot Data. */
function buildAppendixSection({ plots, treatmentIdToCode }) {
  if (!plots?.length) return [];
  const rows = [...plots]
    .sort((a, b) => (treatmentIdToCode[String(a.treatmentId)] || '').localeCompare(treatmentIdToCode[String(b.treatmentId)] || '') || a.replicateNumber - b.replicateNumber)
    .map((p) => [
      treatmentIdToCode[String(p.treatmentId)] || '—',
      String(p.replicateNumber),
      formatThousands(p.yieldKg, 2),
      formatRWF(p.grossRevenueRwf),
      formatRWF(p.cSDTotal),
      formatRWF(p.cSITotal),
      formatRWF(p.totalProductionCost),
      formatRWF(p.netBenefit)
    ]);
  const table = buildTable(['Treatment', 'Rep', 'Yield (kg)', 'Gross Revenue', 'C_SD', 'C_SI', 'Total Cost', 'Net Benefit'], rows, ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto']);
  return [{ text: '', pageBreak: 'before' }, buildSectionTitle('Appendix: Full Raw Plot Data', '📎'), table];
}

/**
 * Assembles every applicable Trial Mode report section into a pdfmake
 * content array. Sections requiring data this trial doesn't have (no RCBD
 * blocks, no partial-budget comparison selected, etc.) are omitted rather
 * than rendered empty, per spec Section 1.
 */
export function buildTrialReportContent({ trial, setup, season, seasonLabel, treatments = [], analysis, partialBudget = null }) {
  const labels = orderedCodes(Object.keys(analysis.cbaSummary.summary));
  const [treatmentA, treatmentB] = labels;
  const treatmentIdToCode = Object.fromEntries((treatments || []).map((t) => [String(t._id), t.code]));
  const groupedPlots = groupPlotsByCodeAndReplicate(analysis.plots, treatmentIdToCode);

  const testedVariables = Object.keys(analysis.anova || {}).filter((v) => analysis.anova[v]?.canCompute);
  const extrapolationFactor = analysis.config?.extrapolationFactor || trial.computed?.extrapolationFactor;

  const componentsA = analysis.costStructure?.[treatmentA]?.components || {};
  const componentsB = analysis.costStructure?.[treatmentB]?.components || {};
  const costLineNames = [...new Set([...Object.keys(componentsA), ...Object.keys(componentsB)])];
  const costLines = costLineNames.map((name) => ({ label: name, meanA: componentsA[name]?.amount ?? 0, meanB: componentsB[name]?.amount ?? 0 }));

  let tableN = 1;
  let figureN = 1;

  const content = [buildCoverSection({ trial, setup, season, seasonLabel })];
  content.push(...buildTrialSummarySection({ trial, treatmentA, treatmentB, testedVariables }));

  content.push(...buildNetDifferentialSection({ cbaSummary: analysis.cbaSummary, treatmentA, treatmentB, extrapolationFactor, groupedPlots, numReplicates: trial.numReplicates, tableN, figureN, costLines }));
  tableN += 1;
  figureN += 1;

  content.push(...buildCbaIndicatorsSection({ cbaSummary: analysis.cbaSummary, breakEven: analysis.breakEven, descriptiveStats: analysis.descriptiveStats, treatmentA, treatmentB, extrapolationFactor, groupedPlots, tableN, figureNGM: figureN, figureNRatios: figureN + 1 }));
  tableN += 1;
  figureN += 2;

  const costSection = buildCostStructureSection({ costStructure: analysis.costStructure, treatmentA, treatmentB, tableN, figureN });
  content.push(...costSection);
  if (costSection.length) {
    tableN += 1;
    figureN += 1;
  }

  content.push(...buildRawDataSection({ testedVariables, descriptiveStats: analysis.descriptiveStats, groupedPlots, treatmentA, treatmentB, tableN }));
  tableN += 1;

  content.push(...buildDescriptiveStatsSection({ testedVariables, descriptiveStats: analysis.descriptiveStats, treatmentA, treatmentB, trialConfig: analysis.config || trial.computed, tableN }));
  tableN += 1;

  const anovaSection = buildAnovaSection({ testedVariables, anova: analysis.anova, tTest: analysis.tTest, treatmentA, treatmentB, tableNStart: tableN });
  content.push(...anovaSection.content);
  tableN = anovaSection.nextTableN;

  const rcbdSection = buildRcbdBlockSection({ trial, rcbdBlockAnalysis: analysis.rcbdBlockAnalysis, tableN });
  content.push(...rcbdSection.content);
  if (rcbdSection.content.length) tableN += 1;

  const stabilitySection = buildStabilitySection({ riskStability: analysis.riskStability, sensitivity: analysis.sensitivity, treatmentA, treatmentB, breakEven: analysis.breakEven, tableN, figureN });
  content.push(...stabilitySection.content);
  if (stabilitySection.content.length) {
    tableN += 1;
    figureN += 1;
  }

  const partialBudgetSection = buildPartialBudgetSection({ partialBudget, treatmentA, treatmentB, tableN, figureN });
  content.push(...partialBudgetSection);
  if (partialBudgetSection.length) {
    tableN += 1;
    figureN += 1;
  }

  content.push(
    ...buildResultsDiscussionSection({
      hypothesisRows: anovaSection.hypothesisRows,
      treatmentA,
      treatmentB,
      costLines,
      groupedPlots,
      favoredTreatment: stabilitySection.favoredTreatment,
      scenarioWinners: stabilitySection.scenarioWinners,
      cbaSummary: analysis.cbaSummary
    })
  );

  content.push(...buildLimitationsSection({ trial, plots: analysis.plots }));
  content.push(...buildAppendixSection({ plots: analysis.plots, treatmentIdToCode }));

  return content.filter(Boolean);
}
