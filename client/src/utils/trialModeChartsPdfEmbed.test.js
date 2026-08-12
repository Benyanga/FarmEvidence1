/**
 * Regression guard for the vector-chart architecture decision (spec Section
 * 4.1: "never rasterize a chart... embed as vector"). pdfmake's SVG support
 * (svg-to-pdfkit under the hood) only understands a subset of SVG — this
 * confirms every trialModeCharts output actually parses and embeds inside a
 * real pdfmake document instead of only being "valid-looking" markup.
 */
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { groupedBarChart, smallMultipleBarChart, waterfallChart, treatmentSeries } from './trialModeCharts';

pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

function buildPdfBase64(svg) {
  return new Promise((resolve, reject) => {
    try {
      const pdf = pdfMake.createPdf({
        pageSize: 'A4',
        content: [{ svg, width: 480 }]
      });
      pdf.getBase64(resolve);
    } catch (error) {
      reject(error);
    }
  });
}

describe('trialModeCharts embed as vector SVG in pdfmake', () => {
  const series = treatmentSeries(['CA', 'CF']);

  it('embeds a groupedBarChart with reference lines', async () => {
    const svg = groupedBarChart({
      data: [{ label: 'Rep 1', values: { CA: 18000, CF: 16087 } }, { label: 'Rep 2', values: { CA: 15500, CF: 16900 } }],
      series,
      unit: 'RWF/plot',
      referenceLines: { CA: 16750, CF: 16493.5 }
    });
    const base64 = await buildPdfBase64(svg);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(1000);
  });

  it('embeds a smallMultipleBarChart', async () => {
    const svg = smallMultipleBarChart({
      series,
      panels: [
        { title: 'BCR', data: [{ label: '', values: { CA: 1.8, CF: 1.5 } }] },
        { title: 'ROI (%)', data: [{ label: '', values: { CA: 22, CF: 18 } }], unit: '%' },
        { title: 'Cost per kg', data: [{ label: '', values: { CA: 210, CF: 260 } }], unit: 'RWF/kg' }
      ]
    });
    const base64 = await buildPdfBase64(svg);
    expect(base64.length).toBeGreaterThan(1000);
  });

  it('embeds a waterfallChart', async () => {
    const svg = waterfallChart({
      treatments: [
        { key: 'CA', label: 'CA', values: { grossRevenue: 100000, totalProductionCost: 40000, netBenefit: 60000 } },
        { key: 'CF', label: 'CF', values: { grossRevenue: 90000, totalProductionCost: 42000, netBenefit: 48000 } }
      ]
    });
    const base64 = await buildPdfBase64(svg);
    expect(base64.length).toBeGreaterThan(1000);
  });
});
