import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { renderChartImage } from './charts';
import { chartCaption } from './seasonalReportInterpretation';
import { buildTrialReportContent } from './trialReportSections';
import { buildFarmerReportContent } from './farmerReportSections';
import ptSerifVfs from './fonts/ptSerifVfs';

// pdfmake's vfs/fonts are NOT plain properties on the `pdfMake` object —
// `vfs_fonts.js` registers Roboto through the internal addVirtualFileSystem()
// store as an import-time side effect, and createPdf() only ever reads that
// internal store (or window.pdfMake.fonts as a fallback for fonts). A plain
// `pdfMake.vfs = {...}` assignment sets an unrelated own property that
// createPdf() never looks at, so it's silently ignored — addVirtualFileSystem
// must be called with the *combined* vfs (Roboto + ours) since it replaces
// the store rather than merging into it.
pdfMake.addVirtualFileSystem({ ...(pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs), ...ptSerifVfs });
// PT Serif stands in for Palatino Linotype (see fonts/ptSerifVfs.js) — every
// report style below renders in this family via BASE_STYLES/defaultStyle.
pdfMake.addFonts({
  Serif: {
    normal: 'PT_Serif-Web-Regular.ttf',
    bold: 'PT_Serif-Web-Bold.ttf',
    italics: 'PT_Serif-Web-Italic.ttf',
    bolditalics: 'PT_Serif-Web-BoldItalic.ttf'
  }
});

// Palette matches the marketing landing page (Landing.css): deep brand
// green + near-black accent, warm off-white panels, forest-tinted body text.
export const BRAND_GREEN = '#0F6E3D';
export const BRAND_DARK = '#111111';
export const CA_COLOR = '#1E2D40';
export const CF_COLOR = '#BA7517';
export const MUTED = '#3E5548';
export const BORDER = '#D8E3DC';
export const PANEL = '#F1F8F4';
export const TEXT = '#0F2A1D';

function fmtGeneratedDate() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** FarmEvidence branding lives here now, on every page — no watermark. */
export function buildPdfHeader(title) {
  return () => ({
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          { text: 'FarmEvidence', style: 'pdfBrand', border: [false, false, false, false] },
          { text: String(title || ''), style: 'pdfHeaderTitle', alignment: 'right', border: [false, false, false, false] }
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
  });
}

export function buildPdfFooter() {
  const generated = fmtGeneratedDate();
  return (currentPage, pageCount) => ({
    columns: [
      { text: `Generated ${generated}`, style: 'pdfFooter', margin: [40, 0, 0, 0] },
      { text: `Page ${currentPage} of ${pageCount}`, style: 'pdfFooter', alignment: 'right', margin: [0, 0, 40, 0] }
    ],
    margin: [0, 8, 0, 0]
  });
}

export const BASE_STYLES = {
  display: { fontSize: 22, bold: true, color: BRAND_GREEN, margin: [0, 0, 0, 6] },
  header: { fontSize: 16, bold: true, color: TEXT, margin: [0, 0, 0, 4] },
  subheader: { fontSize: 12, bold: true, color: BRAND_GREEN, margin: [0, 14, 0, 6] },
  body: { fontSize: 10, color: TEXT, lineHeight: 1.35 },
  mono: { fontSize: 9, color: TEXT },
  caption: { fontSize: 8.5, color: MUTED, italics: true, margin: [0, 4, 0, 10] },
  interpretation: { fontSize: 9, color: TEXT, background: PANEL, border: [true, true, true, true], borderColor: BORDER, fillColor: PANEL, margin: [0, 4, 0, 10], padding: [8, 6, 8, 6] },
  small: { fontSize: 8, color: MUTED },
  table: { fontSize: 9, color: TEXT },
  pdfBrand: { color: '#ffffff', bold: true, fontSize: 12 },
  pdfHeaderTitle: { color: '#ffffff', fontSize: 9 },
  pdfFooter: { color: MUTED, fontSize: 8 }
};

export function coverBlock(title, subtitle, extras = []) {
  return {
    stack: [
      { text: title, style: 'display' },
      subtitle ? { text: subtitle, style: 'body', margin: [0, 0, 0, 6] } : undefined,
      ...extras.map((item) => ({ text: item, style: 'small', margin: [0, 0, 0, 2] })),
      { text: `Generated ${fmtGeneratedDate()}`, color: MUTED, fontSize: 9, margin: [0, 6, 0, 10] }
    ].filter((item) => item !== undefined)
  };
}

export function buildSectionTitle(title, icon = '') {
  const text = `${icon} ${title}`.trim();
  return { text: String(text || ''), style: 'subheader' };
}

export function buildMetricCards(cards) {
  return {
    columns: (cards || []).filter(Boolean).map((card) => ({
      width: '*',
      stack: [
        { text: String(card.label || ''), style: 'small', margin: [0, 0, 0, 4] },
        { text: String(card.value || '—'), style: 'header', color: card.color || BRAND_GREEN, margin: [0, 0, 0, 0] }
      ],
      margin: [0, 0, 8, 0]
    })),
    margin: [0, 0, 0, 10]
  };
}

export function buildTable(headers, rows, widths = null) {
  return {
    table: {
      headerRows: 1,
      widths: widths || headers.map(() => '*'),
      body: [
        headers.map((header) => ({ text: String(header || '—'), style: 'table', bold: true, fillColor: PANEL })),
        ...rows.map((row) => row.map((cell) => ({ text: String(cell ?? '—'), style: 'table' })))
      ]
    },
    layout: {
      fillColor: (rowIndex) => (rowIndex === 0 ? PANEL : null),
      hLineColor: () => BORDER,
      vLineColor: () => BORDER,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4
    },
    margin: [0, 0, 0, 10]
  };
}

export function buildInterpretationBlock(text) {
  if (!text) return null;
  return { text: String(text), style: 'interpretation' };
}

export function formatRWF(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `RWF ${Math.round(value).toLocaleString('en-US')}`;
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function renderSafeChartImage(config) {
  try {
    return await renderChartImage(config);
  } catch (error) {
    return null;
  }
}

/**
 * Deep sanitize object to remove null/undefined values
 */
function sanitizeForPdf(obj) {
  if (obj === null || obj === undefined) return undefined;
  
  if (Array.isArray(obj)) {
    return obj
      .map(sanitizeForPdf)
      .filter((item) => item !== undefined && item !== null);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleaned = sanitizeForPdf(value);
      if (cleaned !== undefined && cleaned !== null) {
        sanitized[key] = cleaned;
      }
    }
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }
  
  return obj;
}

/**
 * Generate a PDF and return it as a Base64 string instead of downloading.
 *
 * pdfmake's `getBase64(cb, options)` takes an *options* object as its second
 * argument, not an error callback — passing a function there (the previous
 * shape of this code) fails pdfmake's internal `isObject(options)` check and
 * throws inside an unguarded async `.then()`, so the failure never reaches
 * this Promise: it neither resolves nor rejects, and every report download
 * hangs forever. The timeout below is the only way to surface that class of
 * internal pdfmake failure instead of hanging the UI indefinitely.
 */
export function generatePdfBase64(docDefinition) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('PDF generation timed out')), 20000);
    try {
      const sanitized = sanitizeForPdf(docDefinition);
      const pdf = pdfMake.createPdf(sanitized);
      pdf.getBase64((base64) => {
        clearTimeout(timeout);
        resolve(base64);
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

export async function downloadSeasonalCBAReport({ title, seasonLabel, snapshot, plots = [] }) {
  try {
    const plotChart = plots.length
      ? await renderSafeChartImage({
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

    const summaryRows = [
      ['Indicator', 'Value'],
      ['CSI', snapshot.csi ?? '—'],
      ['Profit (CA)', formatRWF(snapshot.profitCA)],
      ['Profit (CF)', formatRWF(snapshot.profitCF)],
      ['Adoption Cost', formatRWF(snapshot.adoptionCost)],
      ['TTP', snapshot.ttp ?? '—'],
      ['CNB', formatRWF(snapshot.cnb)]
    ];

    const content = [
      coverBlock(title, seasonLabel, ['Researcher mode', 'Seasonal economics summary']),
      buildSectionTitle('Research summary', '📊'),
      {
        text: 'This report summarises the season-level economics for the selected season and gives each table or chart a short interpretation so the numbers are easier to read and discuss.',
        style: 'body',
        margin: [0, 0, 0, 10]
      },
      buildMetricCards([
        { label: 'Net benefit', value: formatRWF(snapshot.cnb), color: BRAND_GREEN },
        { label: 'Adoption cost', value: formatRWF(snapshot.adoptionCost), color: CA_COLOR },
        { label: 'CSI', value: snapshot.csi ?? '—', color: CF_COLOR }
      ]),
      buildTable(['Indicator', 'Value'], summaryRows, ['*', '*']),
      buildInterpretationBlock(`The reported values indicate a season-level profitability position of ${formatRWF(snapshot.cnb)} with adoption cost of ${formatRWF(snapshot.adoptionCost)}. Follow the plot table below for the treatment-level pattern behind that aggregate result.`),
      buildSectionTitle('Plot detail', '🧾'),
      buildTable(
        ['Farming System', 'Rep', 'Revenue', 'Cost', 'Profit'],
        plots.map((p) => [p.farmingSystem || '—', String(p.replicationNumber || '—'), formatRWF(p.revenue), formatRWF(p.cSystem), formatRWF(p.profit)]),
        ['auto', 'auto', '*', '*', '*']
      ),
      buildInterpretationBlock('Plot-level values reveal the spread of revenue, cost and profit across the season, which helps explain whether the aggregate result reflects a broad pattern or a few outlier plots.'),
      plotChart ? buildSectionTitle('Chart view', '📈') : null,
      plotChart ? { image: plotChart, width: 420, margin: [0, 4, 0, 10] } : null,
      plotChart ? buildInterpretationBlock(chartCaption({ metricLabel: 'Profit', unit: 'RWF', treatmentA: 'CA', treatmentB: 'CF', meanA: snapshot.profitCA || 0, meanB: snapshot.profitCF || 0 })) : null
    ].filter(Boolean);

    const docDefinition = {
      info: { Title: String(title || ''), Subject: 'Seasonal report', Creator: 'FarmEvidence' },
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 50],
      header: buildPdfHeader(title),
      footer: buildPdfFooter(),
      content: content.filter(Boolean).filter((item) => item !== null && item !== undefined),
      styles: BASE_STYLES,
      defaultStyle: { font: 'Serif' }
    };

    const pdfData = await generatePdfBase64(docDefinition);
    return pdfData;
  } catch (error) {
    console.error('downloadSeasonalCBAReport error:', error);
    throw error;
  }
}

/**
 * Trial Mode (Researcher Mode) closure report — full 14-section structure
 * per FarmEvidence_TrialMode_Report_Spec.md. Section assembly (tables,
 * interpretations, vector charts) lives in ./trialReportSections, which is
 * independently testable as plain content-array construction; this function
 * only wraps that content into a docDefinition and renders it.
 */
export async function downloadTrialReport({ trial, setup, season, seasonLabel, treatments, analysis, partialBudget }) {
  try {
    const content = buildTrialReportContent({ trial, setup, season, seasonLabel, treatments, analysis, partialBudget });
    const title = `${trial.crop}${trial.variety ? ` (${trial.variety})` : ''} — Trial Analysis Report`;

    const docDefinition = {
      info: { Title: String(title || ''), Subject: 'Trial analysis report', Creator: 'FarmEvidence' },
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 50],
      header: buildPdfHeader(title),
      footer: buildPdfFooter(),
      content,
      styles: BASE_STYLES,
      defaultStyle: { font: 'Serif' }
    };

    const pdfData = await generatePdfBase64(docDefinition);
    return pdfData;
  } catch (error) {
    console.error('downloadTrialReport error:', error);
    throw error;
  }
}

/**
 * Farmer Mode seasonal report — a bookkeeping/profitability report for one
 * farmer's own season (never a CA-vs-CF comparison) per
 * FarmEvidence_FarmerMode_Report_Spec.md. Section assembly lives in
 * ./farmerReportSections, a deliberately separate, simpler template from
 * the Researcher Mode one (own header/footer/styles — no FarmEvidence brand
 * bar, no watermark, centered page-number-only footer).
 */
export async function downloadFarmerSeasonalReport({
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
  cooperativeAvgProfit = null
}) {
  try {
    const { content, header, footer, styles } = buildFarmerReportContent({
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
      inputCosts,
      laborCosts,
      priorSeasons,
      cooperativeAvgProfit,
      fmtDate
    });

    const title = `${farmerName} — Seasonal Report`;
    const docDefinition = {
      info: { Title: title, Subject: 'Farmer seasonal report', Creator: 'FarmEvidence' },
      pageSize: 'A4',
      pageMargins: [40, 56, 40, 40],
      header,
      footer,
      content,
      styles: { ...BASE_STYLES, ...styles },
      defaultStyle: { font: 'Serif' }
    };

    const pdfData = await generatePdfBase64(docDefinition);
    return pdfData;
  } catch (error) {
    console.error('downloadFarmerSeasonalReport error:', error);
    throw error;
  }
}
