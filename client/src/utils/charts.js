import api from '../services/api';

/**
 * Requests a chart image from the Python graphing service (via the Node
 * proxy at /charts/render) and returns a `data:image/png;base64,...` URI.
 * Used by both dashboards (§5) and PDF report generation (§6) so every
 * graph in the platform is rendered by the same matplotlib pipeline.
 */
export async function renderChartImage({ type, labels, series, title, xLabel, yLabel, stacked }) {
  const { data } = await api.post('/charts/render', { type, labels, series, title, xLabel, yLabel, stacked });
  return data.image;
}
