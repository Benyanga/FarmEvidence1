/* ==========================================================================
   FarmEvidence — Chart Theme
   Defines how every graph in the app must look, in two flavours:
     - DASHBOARD  : live, interactive, in app (DM Sans, soft grid, tooltips)
     - REPORT     : static, print resolution, exported PDFs (Palatino,
                    higher contrast, no tooltips, no shadows)
   Both flavours pull their colours from styles/design-tokens.css so a
   chart on screen and the same chart in a downloaded report never
   disagree. design-tokens.css must be imported globally (see index.css)
   before this module's tokens are read.

   Currently used for standalone SVG builders (no Python round-trip) —
   the live dashboards render their charts via the Python chart service
   (see utils/charts.js) using this same colour set, kept in sync
   manually in python-service/chart_style.py (Python can't read CSS
   custom properties). These builders are available for contexts where a
   Python round-trip isn't wanted, e.g. print/report generation.
   ========================================================================== */

const css = getComputedStyle(document.documentElement);
const token = (name, fallback) => (css.getPropertyValue(name) || fallback).trim() || fallback;

/* ---------------------------------------------------------------------
   THEME OBJECTS
   --------------------------------------------------------------------- */
export const dashboardChartTheme = {
  name: 'dashboard',
  font: token('--fe-font-ui', "'DM Sans', system-ui, sans-serif"),
  fontSize: 11,
  axisColor: token('--fe-gray-500', '#9CA3AF'),
  gridColor: token('--fe-gray-200', '#E2E8F0'),
  gridDash: '3,3',
  cardBg: token('--fe-gray-0', '#FFFFFF'),
  cornerRadius: 4,
  strokeWidth: 2,
  dotRadius: 3.5,
  tooltip: { bg: '#FFFFFF', border: token('--fe-gray-200', '#E2E8F0'), shadow: '0 4px 12px rgba(0,0,0,0.08)' },
  legend: { dotSize: 8, gap: 6, fontSize: 10 },
  animation: true
};

export const reportChartTheme = {
  name: 'report',
  font: token('--fe-font-print', "'Palatino Linotype', Palatino, serif"),
  fontSize: 10,
  axisColor: token('--fe-gray-900', '#1A1A1A'),
  gridColor: token('--fe-gray-300', '#D4D4D0'),
  gridDash: 'none',
  cardBg: '#FFFFFF',
  cornerRadius: 1.5,
  strokeWidth: 2.5,
  dotRadius: 3,
  tooltip: null, /* print has no interaction, captions only */
  legend: { dotSize: 7, gap: 8, fontSize: 9 },
  animation: false
};

/* ---------------------------------------------------------------------
   COLOUR RESOLUTION
   --------------------------------------------------------------------- */
export const TREATMENT = {
  CA: { solid: token('--fe-ca', '#1E2D40'), tint: token('--fe-ca-tint', 'rgba(30,45,64,0.12)') },
  CF: { solid: token('--fe-cf', '#BA7517'), tint: token('--fe-cf-tint', 'rgba(186,117,23,0.12)') }
};

export const CATEGORICAL = [
  token('--fe-cat-1', '#008568'),
  token('--fe-cat-2', '#2D66A7'),
  token('--fe-cat-3', '#AA7E19'),
  token('--fe-cat-4', '#B8654F'),
  token('--fe-cat-5', '#8361AD'),
  token('--fe-cat-6', '#6B8F47'),
  token('--fe-cat-7', '#95902A'),
  token('--fe-cat-8', '#1493C1')
];

export const SEMANTIC = {
  positive: token('--fe-positive-line', '#22C55E'),
  caution: token('--fe-caution-line', '#F59E0B'),
  negative: token('--fe-negative-line', '#EF4444'),
  info: token('--fe-info-line', '#185FA5')
};

/** Resolve a treatment code to its fixed identity colour. Never reassign. */
export function treatmentColor(code) {
  return (TREATMENT[code] && TREATMENT[code].solid) || token('--fe-gray-600', '#6B7280');
}

/** White text fails contrast on the CF amber fill; dark text is used
 *  instead so header rows stay WCAG AA regardless of which treatment. */
export function treatmentTextColor(code) {
  return code === 'CF' ? token('--fe-gray-900', '#1A1A1A') : '#FFFFFF';
}

/** Cycle through the categorical palette for cost categories, alert
 *  types, or any series count that is not exactly the CA/CF pair. */
export function categoricalColor(index) {
  return CATEGORICAL[index % CATEGORICAL.length];
}

/** Favourability is metric aware, never assumed to default to CA.
 *  higherIsBetter=true for profit/revenue/yield/BCR/ROI,
 *  false for cost, cost per kg, labour cost. */
export function favourable(current, prior, higherIsBetter = true) {
  if (prior == null) return null;
  const delta = current - prior;
  if (delta === 0) return 'flat';
  const up = delta > 0;
  return higherIsBetter ? (up ? 'positive' : 'negative') : up ? 'negative' : 'positive';
}

export function semanticColor(state) {
  return SEMANTIC[state] || token('--fe-gray-600', '#6B7280');
}

/* ---------------------------------------------------------------------
   SVG CHART BUILDERS
   Minimal, dependency free renderers so charts are identical whether
   drawn live on the dashboard or baked into a PDF export. Each builder
   accepts a `theme` (dashboardChartTheme or reportChartTheme) so the
   same data produces the on screen and print versions from one call.
   --------------------------------------------------------------------- */

// width/height attributes are required, not just viewBox — an inline <svg>
// with only a viewBox has no CSS intrinsic size, so it silently collapses to
// 0×0 in a flex container (found via the donut chart, whose parent is a flex
// row; the bar/line charts happened to sit in block containers where this
// didn't visibly break). style keeps it responsive to the container's width.
const svgOpen = (w, h) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="width:100%;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">`;

/**
 * Grouped bar chart comparing CA vs CF for one or more metrics.
 * data: [{ label: "Profit", ca: 185000, cf: 142000 }, ...]
 */
export function buildTreatmentBarChart(data, { width = 320, height = 160, theme = dashboardChartTheme } = {}) {
  const padL = 44,
    padB = 22,
    padT = 10,
    padR = 10;
  const innerW = width - padL - padR,
    innerH = height - padT - padB;
  const groupW = innerW / data.length;
  const barW = Math.min(28, groupW * 0.32);
  const maxVal = Math.max(...data.flatMap((d) => [d.ca, d.cf])) * 1.1;
  const y = (v) => padT + innerH - (v / maxVal) * innerH;

  let bars = '',
    labels = '',
    grid = '';
  for (let i = 0; i <= 4; i++) {
    const gy = padT + (innerH / 4) * i;
    grid += `<line x1="${padL}" y1="${gy}" x2="${width - padR}" y2="${gy}" stroke="${theme.gridColor}" stroke-width="1" stroke-dasharray="${theme.gridDash === 'none' ? '' : theme.gridDash}"/>`;
  }
  data.forEach((d, i) => {
    const gx = padL + i * groupW + groupW / 2;
    const caX = gx - barW - 3,
      cfX = gx + 3;
    const caY = y(d.ca),
      cfY = y(d.cf);
    bars += `<rect x="${caX}" y="${caY}" width="${barW}" height="${padT + innerH - caY}" rx="${theme.cornerRadius}" fill="${TREATMENT.CA.solid}"/>`;
    bars += `<rect x="${cfX}" y="${cfY}" width="${barW}" height="${padT + innerH - cfY}" rx="${theme.cornerRadius}" fill="${TREATMENT.CF.solid}"/>`;
    labels += `<text x="${gx}" y="${height - 6}" font-size="${theme.fontSize - 1}" fill="${theme.axisColor}" text-anchor="middle" font-family="${theme.font}">${d.label}</text>`;
  });

  return `${svgOpen(width, height)}${grid}${bars}${labels}</svg>`;
}

/**
 * Multi season line chart, one line per treatment segment present in
 * the data. series: [{ label:"Season B 2026", value:185000, treatment:"CA" }, ...]
 */
export function buildTrendLineChart(series, { width = 320, height = 130, theme = dashboardChartTheme } = {}) {
  const padL = 36,
    padB = 20,
    padT = 10,
    padR = 10;
  const innerW = width - padL - padR,
    innerH = height - padT - padB;
  const vals = series.map((s) => s.value);
  const min = Math.min(...vals),
    max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = innerW / (series.length - 1 || 1);
  const pt = (s, i) => ({
    x: padL + i * stepX,
    y: padT + innerH - ((s.value - min) / range) * innerH
  });
  const points = series.map(pt);

  let grid = '';
  for (let i = 0; i <= 3; i++) {
    const gy = padT + (innerH / 3) * i;
    grid += `<line x1="${padL}" y1="${gy}" x2="${width - padR}" y2="${gy}" stroke="${theme.gridColor}" stroke-width="1" stroke-dasharray="${theme.gridDash === 'none' ? '' : theme.gridDash}"/>`;
  }

  /* Straight segments only — no smoothing, so the line never implies
     data between recorded seasons that was not actually measured. */
  let path = '',
    dots = '',
    labels = '';
  points.forEach((p, i) => {
    path += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' ';
    dots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${theme.dotRadius}" fill="${treatmentColor(series[i].treatment)}"/>`;
    labels += `<text x="${p.x.toFixed(1)}" y="${height - 4}" font-size="${theme.fontSize - 2}" fill="${theme.axisColor}" text-anchor="middle" font-family="${theme.font}">${series[i].label.replace(/Season /, '')}</text>`;
  });

  return `${svgOpen(width, height)}${grid}<path d="${path.trim()}" fill="none" stroke="${theme.name === 'report' ? token('--fe-brand-700', '#2C5F3E') : token('--fe-brand-500', '#4A7C59')}" stroke-width="${theme.strokeWidth}"/>${dots}${labels}</svg>`;
}

/**
 * Donut chart for cost or category breakdowns using the categorical
 * palette. data: [{ label:"Labour", value:28000 }, ...]
 */
export function buildDonutChart(data, { size = 140, theme = dashboardChartTheme, centerLabel = '' } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 8,
    cx = size / 2,
    cy = size / 2,
    thickness = r * 0.38;
  let angle = -90,
    arcs = '';
  data.forEach((d, i) => {
    const sweep = (d.value / total) * 360;
    const large = sweep > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos((Math.PI / 180) * angle);
    const y1 = cy + r * Math.sin((Math.PI / 180) * angle);
    const end = angle + sweep;
    const x2 = cx + r * Math.cos((Math.PI / 180) * end);
    const y2 = cy + r * Math.sin((Math.PI / 180) * end);
    arcs += `<path d="M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}" fill="none" stroke="${categoricalColor(i)}" stroke-width="${thickness}"/>`;
    angle = end;
  });
  const label = centerLabel
    ? `<text x="${cx}" y="${cy + 4}" font-size="${theme.fontSize + 3}" font-weight="700" fill="${theme.axisColor}" text-anchor="middle" font-family="${theme.font}">${centerLabel}</text>`
    : '';
  return `${svgOpen(size, size)}${arcs}${label}</svg>`;
}

/**
 * Legend row matching a categorical or treatment series, styled per
 * theme so dashboard and report legends read consistently.
 */
export function buildLegend(items, { theme = dashboardChartTheme } = {}) {
  const chip = (color, label) =>
    `<span style="display:inline-flex;align-items:center;gap:${theme.legend.gap}px;margin-right:14px;font-family:${theme.font};font-size:${theme.legend.fontSize}px;color:${theme.axisColor};">
       <span style="width:${theme.legend.dotSize}px;height:${theme.legend.dotSize}px;border-radius:50%;background:${color};display:inline-block;"></span>${label}
     </span>`;
  return `<div style="display:flex;flex-wrap:wrap;align-items:center;">${items.map((it) => chip(it.color, it.label)).join('')}</div>`;
}
