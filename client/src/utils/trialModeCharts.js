/**
 * Trial Mode (Researcher Mode) chart components.
 * Implements FarmEvidence_TrialMode_Report_Spec.md Section 4 — vector-only
 * SVG builders (no Python/raster round-trip) so every figure stays crisp at
 * print resolution and embeds directly into pdfmake via an `{ svg }` node.
 *
 * Three reusable chart types cover every figure the spec requires:
 * groupedBarChart (Figures 5/6/8/21), smallMultipleBarChart (Figure 7),
 * waterfallChart (Figure 22). All three share the report theme/colour
 * tokens from ./chartTheme so a chart never disagrees with the rest of
 * the report's print styling.
 */

import { reportChartTheme, treatmentColor } from './chartTheme';
import { formatThousands } from './trialModeInterpretation';

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function svgOpen(w, h) {
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="width:100%;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">`;
}

/** Rounds a scale ceiling up to a "nice" 1/2/5-step value so gridlines land on readable numbers. */
function niceMax(value) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;
  const step = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Builds the series config (fixed treatment colours) from plain codes or {code,label} pairs. */
function treatmentSeries(items) {
  return items.map((item) => {
    const code = typeof item === 'string' ? item : item.code;
    const label = typeof item === 'string' ? item : item.label || item.code;
    return { key: code, label, color: (typeof item === 'object' && item.color) || treatmentColor(code) };
  });
}

/** Section 4.1 — legend top-right, no border/box; only ever called when more than one series is plotted. */
function buildTopRightLegend(items, { theme, width, padR = 16, topY = 14 }) {
  const chipSize = theme.legend.dotSize;
  const itemGap = 14;
  const estWidth = (label) => chipSize + 4 + label.length * (theme.legend.fontSize * 0.58) + itemGap;
  const totalWidth = items.reduce((sum, it) => sum + estWidth(it.label), 0);

  let x = width - padR - totalWidth;
  let out = '';
  items.forEach((it) => {
    out += `<rect x="${x.toFixed(1)}" y="${(topY - chipSize + 2).toFixed(1)}" width="${chipSize}" height="${chipSize}" rx="1.5" fill="${it.color}"/>`;
    out += `<text x="${(x + chipSize + 4).toFixed(1)}" y="${(topY + 2).toFixed(1)}" font-size="${theme.legend.fontSize}" fill="${theme.axisColor}" font-family="${theme.font}">${esc(it.label)}</text>`;
    x += estWidth(it.label);
  });
  return out;
}

/**
 * Core grouped-bar drawing logic, returned as inner markup (no <svg> wrapper
 * or legend) so it can be reused standalone or embedded per-panel inside
 * smallMultipleBarChart.
 */
function groupedBarMarkup({ data, series, yLabel = '', unit = '', dp = 0, referenceLines = null, theme, width, height, showGroupLabels = true }) {
  const padL = 56;
  const padR = 16;
  const padT = 20;
  const hasSubLabels = showGroupLabels && data.some((d) => d.subLabel);
  const padB = showGroupLabels ? (hasSubLabels ? 44 : 34) : 16;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const allValues = data.flatMap((d) => series.map((s) => d.values[s.key] || 0));
  if (referenceLines) allValues.push(...Object.values(referenceLines).filter((v) => typeof v === 'number'));
  const maxVal = niceMax(Math.max(...allValues, 0) * 1.15);

  const y = (v) => padT + innerH - (v / maxVal) * innerH;
  const yZero = y(0);

  const groupW = innerW / data.length;
  const barGap = 4;
  const barW = Math.min(34, (groupW - barGap * (series.length + 1)) / series.length);

  const TICKS = 4;
  let grid = '';
  for (let i = 0; i <= TICKS; i += 1) {
    const v = (maxVal / TICKS) * i;
    const gy = y(v);
    grid += `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${width - padR}" y2="${gy.toFixed(1)}" stroke="${theme.gridColor}" stroke-width="1"/>`;
    grid += `<text x="${padL - 6}" y="${(gy + 3).toFixed(1)}" font-size="${theme.fontSize - 1}" fill="${theme.axisColor}" text-anchor="end" font-family="${theme.font}">${formatThousands(v, dp)}</text>`;
  }

  let bars = '';
  let labels = '';
  data.forEach((d, gi) => {
    const groupX0 = padL + gi * groupW;
    const totalBarsWidth = barW * series.length + barGap * (series.length - 1);
    const startX = groupX0 + (groupW - totalBarsWidth) / 2;

    series.forEach((s, si) => {
      const val = d.values[s.key] || 0;
      const x = startX + si * (barW + barGap);
      const yTop = y(Math.max(val, 0));
      const barHeight = Math.max(0, Math.abs(yZero - yTop));
      const rectY = val >= 0 ? yTop : yZero;
      bars += `<rect x="${x.toFixed(1)}" y="${rectY.toFixed(1)}" width="${barW.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="${theme.cornerRadius}" fill="${s.color}"/>`;

      const labelY = val >= 0 ? yTop - 4 : yZero + 10;
      labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${labelY.toFixed(1)}" font-size="${theme.fontSize - 1}" font-weight="700" text-anchor="middle" fill="${theme.axisColor}" font-family="${theme.font}">${formatThousands(val, dp)}</text>`;
    });

    if (showGroupLabels && d.label) {
      const labelY = hasSubLabels ? height - 20 : height - 8;
      labels += `<text x="${(groupX0 + groupW / 2).toFixed(1)}" y="${labelY}" font-size="${theme.fontSize}" text-anchor="middle" fill="${theme.axisColor}" font-family="${theme.font}">${esc(d.label)}</text>`;
    }
    if (showGroupLabels && d.subLabel) {
      labels += `<text x="${(groupX0 + groupW / 2).toFixed(1)}" y="${height - 8}" font-size="${theme.fontSize - 2}" text-anchor="middle" fill="${theme.axisColor}" font-family="${theme.font}">(${esc(d.subLabel)})</text>`;
    }
  });

  let refLines = '';
  if (referenceLines) {
    series.forEach((s) => {
      const refVal = referenceLines[s.key];
      if (typeof refVal !== 'number') return;
      const ry = y(refVal);
      refLines += `<line x1="${padL}" y1="${ry.toFixed(1)}" x2="${width - padR}" y2="${ry.toFixed(1)}" stroke="${s.color}" stroke-width="1.5" stroke-dasharray="5,3"/>`;
    });
  }

  const axisLabel = unit || yLabel
    ? `<text x="${padL}" y="${padT - 8}" font-size="${theme.fontSize - 1}" fill="${theme.axisColor}" font-family="${theme.font}">${esc(unit || yLabel)}</text>`
    : '';

  return `${grid}${refLines}${bars}${labels}${axisLabel}`;
}

/**
 * Section 4.2 — grouped bar by replicate (Figures 5, 6, 8, 21). Pass
 * `referenceLines: { CA: mean, CF: mean }` for Figure 5's dashed treatment
 * means; omit it for the plain grouped-bar figures.
 * data: [{ label: 'Rep 1', values: { CA: 18000, CF: 16087 } }, ...]
 */
export function groupedBarChart({ data, series, yLabel = '', unit = '', dp = 0, referenceLines = null, theme = reportChartTheme, width = 480, height = 220 }) {
  const seriesResolved = series.map((s) => ({ ...s, color: s.color || treatmentColor(s.key) }));
  const markup = groupedBarMarkup({ data, series: seriesResolved, yLabel, unit, dp, referenceLines, theme, width, height });
  const legend = seriesResolved.length > 1 ? buildTopRightLegend(seriesResolved, { theme, width }) : '';
  return `${svgOpen(width, height)}${markup}${legend}</svg>`;
}

/**
 * Section 4.2 — 3-panel small multiple (Figure 7: BCR / ROI / Cost-per-kg).
 * Each panel gets its own independent y-axis; one shared top-right legend.
 * panels: [{ title, data, unit, dp }]
 */
export function smallMultipleBarChart({ panels, series, theme = reportChartTheme, width = 480, height = 210, gap = 24 }) {
  const seriesResolved = series.map((s) => ({ ...s, color: s.color || treatmentColor(s.key) }));
  const panelWidth = (width - gap * (panels.length - 1)) / panels.length;
  // The shared legend gets its own row (legendRowHeight) strictly above the
  // panel-title row (titleRowHeight) — both previously shared the same top
  // strip, so a long panel title (e.g. "Cost per kg (RWF)") on the right-most
  // panel visually collided with the top-right legend chips there.
  const legendRowHeight = seriesResolved.length > 1 ? 20 : 0;
  const titleRowHeight = 22;
  const topOffset = legendRowHeight + titleRowHeight;
  const panelHeight = height - topOffset;

  let out = '';
  panels.forEach((panel, i) => {
    const offsetX = i * (panelWidth + gap);
    const markup = groupedBarMarkup({
      data: panel.data,
      series: seriesResolved,
      unit: panel.unit || '',
      dp: panel.dp ?? 1,
      theme,
      width: panelWidth,
      height: panelHeight,
      showGroupLabels: false
    });
    out += `<g transform="translate(${offsetX.toFixed(1)}, ${topOffset})">
      <text x="${(panelWidth / 2).toFixed(1)}" y="-8" font-size="${theme.fontSize}" font-weight="700" text-anchor="middle" fill="${theme.axisColor}" font-family="${theme.font}">${esc(panel.title)}</text>
      ${markup}
    </g>`;
  });

  const legend = seriesResolved.length > 1 ? buildTopRightLegend(seriesResolved, { theme, width, topY: 12 }) : '';
  return `${svgOpen(width, height)}${legend}${out}</svg>`;
}

/**
 * Section 4.3 — floating-bar waterfall for the Partial Budget (Figure 22).
 * Computes each treatment's running total independently: 'zero'-anchored
 * stages draw from 0 (the first and last stages); 'float' stages draw from
 * the running total, mirroring the source report's 4-stage structure.
 */
function computeWaterfallBars(stages, values) {
  let running = 0;
  return stages.map((stage) => {
    const raw = values[stage.key] ?? 0;
    if (stage.anchor === 'zero') {
      running = raw;
      return { key: stage.key, y0: 0, y1: raw, value: raw };
    }
    const delta = (stage.sign || 1) * raw;
    const y0 = running;
    const y1 = running + delta;
    running = y1;
    return { key: stage.key, y0, y1, value: delta };
  });
}

const DEFAULT_WATERFALL_STAGES = [
  { key: 'grossRevenue', label: 'Gross Revenue', anchor: 'zero' },
  { key: 'totalProductionCost', label: 'Total Production Cost', anchor: 'float', sign: -1 },
  { key: 'labourDifferential', label: 'Labour Differential', anchor: 'float', sign: -1, optional: true },
  { key: 'netBenefit', label: 'Net Benefit', anchor: 'zero' }
];

/**
 * treatments: [{ key, label, color?, values: { grossRevenue, totalProductionCost, labourDifferential?, netBenefit } }]
 */
export function waterfallChart({ treatments, stages = DEFAULT_WATERFALL_STAGES, unit = 'RWF', dp = 0, theme = reportChartTheme, width = 480, height = 260 }) {
  const activeStages = stages.filter((stage) => !stage.optional || treatments.some((t) => typeof t.values[stage.key] === 'number'));
  const treatmentsResolved = treatments.map((t) => ({ ...t, color: t.color || treatmentColor(t.key) }));
  const perTreatmentBars = treatmentsResolved.map((t) => computeWaterfallBars(activeStages, t.values));

  const allYs = perTreatmentBars.flat().flatMap((b) => [b.y0, b.y1]);
  const minY = Math.min(0, ...allYs);
  const maxY = niceMax(Math.max(...allYs, 0) * 1.15);

  const padL = 60;
  const padR = 16;
  const padT = 20;
  const padB = 40;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const y = (v) => padT + innerH - ((v - minY) / (maxY - minY || 1)) * innerH;

  const TICKS = 4;
  let grid = '';
  for (let i = 0; i <= TICKS; i += 1) {
    const v = minY + ((maxY - minY) / TICKS) * i;
    const gy = y(v);
    grid += `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${width - padR}" y2="${gy.toFixed(1)}" stroke="${theme.gridColor}" stroke-width="1"/>`;
    grid += `<text x="${padL - 6}" y="${(gy + 3).toFixed(1)}" font-size="${theme.fontSize - 1}" text-anchor="end" fill="${theme.axisColor}" font-family="${theme.font}">${formatThousands(v, dp)}</text>`;
  }

  const groupW = innerW / activeStages.length;
  const barW = Math.min(30, (groupW - 12) / treatmentsResolved.length / 1.4);
  const barGap = 6;

  let bars = '';
  let labels = '';
  let connectors = '';

  activeStages.forEach((stage, si) => {
    const groupX0 = padL + si * groupW;
    const totalW = barW * treatmentsResolved.length + barGap * (treatmentsResolved.length - 1);
    const startX = groupX0 + (groupW - totalW) / 2;

    treatmentsResolved.forEach((t, ti) => {
      const bar = perTreatmentBars[ti][si];
      const x = startX + ti * (barW + barGap);
      const yTop = y(Math.max(bar.y0, bar.y1));
      const yBottom = y(Math.min(bar.y0, bar.y1));
      const barHeight = Math.max(1, yBottom - yTop);
      bars += `<rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="${theme.cornerRadius}" fill="${t.color}" fill-opacity="${stage.anchor === 'float' ? 0.75 : 1}"/>`;

      const positive = bar.value >= 0;
      const labelY = positive ? yTop - 4 : yBottom + 10;
      labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${labelY.toFixed(1)}" font-size="${theme.fontSize - 1}" font-weight="700" text-anchor="middle" fill="${theme.axisColor}" font-family="${theme.font}">${formatThousands(bar.value, dp)}</text>`;

      if (si < activeStages.length - 1) {
        const nextBar = perTreatmentBars[ti][si + 1];
        if (nextBar.y0 === bar.y1) {
          const connY = y(bar.y1);
          const nextGroupX0 = padL + (si + 1) * groupW;
          const nextStartX = nextGroupX0 + (groupW - totalW) / 2;
          const nextX = nextStartX + ti * (barW + barGap);
          connectors += `<line x1="${(x + barW).toFixed(1)}" y1="${connY.toFixed(1)}" x2="${nextX.toFixed(1)}" y2="${connY.toFixed(1)}" stroke="${theme.gridColor}" stroke-width="1" stroke-dasharray="2,2"/>`;
        }
      }
    });

    labels += `<text x="${(groupX0 + groupW / 2).toFixed(1)}" y="${height - 8}" font-size="${theme.fontSize}" text-anchor="middle" fill="${theme.axisColor}" font-family="${theme.font}">${esc(stage.label)}</text>`;
  });

  const yAxisLabel = unit ? `<text x="${padL}" y="${padT - 8}" font-size="${theme.fontSize - 1}" fill="${theme.axisColor}" font-family="${theme.font}">${esc(unit)}</text>` : '';
  const legend = treatmentsResolved.length > 1 ? buildTopRightLegend(treatmentsResolved, { theme, width }) : '';

  return `${svgOpen(width, height)}${grid}${bars}${connectors}${labels}${yAxisLabel}${legend}</svg>`;
}

/** Section 2/4.1 — the numbered caption convention shared by every table and chart. */
function buildChartCaption(figureNumber, description) {
  return `Figure ${figureNumber}. ${description}`;
}

export { treatmentSeries, computeWaterfallBars, buildChartCaption, DEFAULT_WATERFALL_STAGES };

const trialModeCharts = {
  groupedBarChart,
  smallMultipleBarChart,
  waterfallChart,
  treatmentSeries,
  computeWaterfallBars,
  buildChartCaption
};

export default trialModeCharts;
