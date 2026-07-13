const { renderChart } = require('../services/pythonChartService');

/** POST /charts/render — thin authenticated proxy to the Python chart-rendering service. */
async function renderChartRoute(req, res, next) {
  try {
    const { image } = await renderChart(req.body);
    res.json({ image });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: { code: 'CHART_SERVICE_UNAVAILABLE', message: 'Chart rendering service is not running.' } });
    }
    next(err);
  }
}

module.exports = { renderChartRoute };
