/**
 * Farmer Mode chart components.
 * Implements FarmEvidence_FarmerMode_Report_Spec.md Section 2's chart rule:
 * "same vector-SVG, data-labeled, horizontal-gridline-only style as
 * Researcher Mode charts... Use Palatino Linotype for chart text too" — so
 * this reuses the exact same report theme (already Palatino-first) and the
 * proven groupedBarChart component from ./trialModeCharts, rather than
 * inventing a second chart style. Colour usage is minimal and functional:
 * a single system accent colour throughout, never the other system's colour
 * (Farmer Mode reports on one system, never a CA-vs-CF comparison).
 */

import { reportChartTheme } from './chartTheme';
import { formatThousands } from './trialModeInterpretation';
import { groupedBarChart } from './trialModeCharts';

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function svgOpen(w, h) {
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="width:100%;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">`;
}

function niceMax(value) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;
  const step = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Hex colour -> rgba string at the given opacity, for the "one shade per category" rule (Section 3.3). */
function withOpacity(hexColor, opacity) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Section 3.3 — "Where Your Money Went". One bar per farmer-facing cost
 * category (already sorted by the interpretation layer), all in the single
 * system accent colour at decreasing opacity by rank — never a rainbow
 * categorical palette, since colour here is "minimal and functional."
 * categories: [{ label, value }], sorted largest first.
 */
export function costCategoryChart({ categories, color, unit = 'RWF', dp = 0, theme = reportChartTheme, width = 480, height = 220 }) {
  const padL = 56;
  const padR = 16;
  const padT = 20;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const maxVal = niceMax(Math.max(...categories.map((c) => c.value), 0) * 1.15);
  const y = (v) => padT + innerH - (v / maxVal) * innerH;
  const yZero = y(0);

  const groupW = innerW / categories.length;
  const barW = Math.min(48, groupW * 0.55);

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
  categories.forEach((cat, i) => {
    const groupX0 = padL + i * groupW;
    const x = groupX0 + (groupW - barW) / 2;
    const opacity = Math.max(0.35, 1 - i * 0.2);
    const yTop = y(cat.value);
    const barHeight = Math.max(0, yZero - yTop);
    bars += `<rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="${theme.cornerRadius}" fill="${withOpacity(color, opacity)}"/>`;
    labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(yTop - 4).toFixed(1)}" font-size="${theme.fontSize - 1}" font-weight="700" text-anchor="middle" fill="${theme.axisColor}" font-family="${theme.font}">${formatThousands(cat.value, dp)}</text>`;
    labels += `<text x="${(groupX0 + groupW / 2).toFixed(1)}" y="${height - 8}" font-size="${theme.fontSize}" text-anchor="middle" fill="${theme.axisColor}" font-family="${theme.font}">${esc(cat.label)}</text>`;
  });

  const axisLabel = unit ? `<text x="${padL}" y="${padT - 8}" font-size="${theme.fontSize - 1}" fill="${theme.axisColor}" font-family="${theme.font}">${esc(unit)}</text>` : '';

  return `${svgOpen(width, height)}${grid}${bars}${labels}${axisLabel}</svg>`;
}

/**
 * Section 3.5 — "How This Season Compares" (own history only). One bar per
 * season, single accent colour; any season farmed under a different system
 * than the current one gets a small "(CA)"/"(CF)" tag under its bar so nothing
 * is misrepresented, without implying a controlled comparison.
 * seasons: [{ label, value, system }] in chronological order, current season last.
 */
export function ownHistoryChart({ seasons, currentSystem, color, unit = 'RWF', dp = 0, theme = reportChartTheme, width = 480, height = 220 }) {
  const data = seasons.map((s) => ({
    label: s.label,
    subLabel: s.system && s.system !== currentSystem ? s.system : null,
    values: { profit: s.value }
  }));
  return groupedBarChart({ data, series: [{ key: 'profit', label: 'Net Profit', color }], unit, dp, theme, width, height });
}

const farmerModeCharts = { costCategoryChart, ownHistoryChart };

export default farmerModeCharts;
