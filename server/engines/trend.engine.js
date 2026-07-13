/**
 * Trend Engine — Δ_X(t) classification across seasons, pure function.
 * See docs/COMPUTATION_ENGINE.md §7.
 */

const TRACKED_INDICATORS = [
  'profit_CA',
  'profit_CF',
  'profit_CAplus',
  'profit_CFplus',
  'yield_CA',
  'yield_CF',
  'adoptionCost',
  'csi',
  'biomassYield',
  'grainYield',
  'soilOrganicCarbon',
  'soilMoisture',
  'plantHeight',
  'leafAreaIndex',
  'erosionScore'
];

const STABLE_THRESHOLD_RATIO = 0.05;

/**
 * @param {string} indicator
 * @param {Array<{season:number, value:number}>} series - unsorted allowed; nulls filtered out
 */
function computeTrend(indicator, series = []) {
  const points = series
    .filter((p) => typeof p.value === 'number')
    .sort((a, b) => a.season - b.season);

  if (points.length < 2) {
    return {
      indicator,
      timeSeries: points.map((p) => ({ season: p.season, value: p.value, delta: null })),
      classification: 'Insufficient',
      trendMagnitude: null,
      recommendation: `Collect at least 2 seasons of ${indicator} data to compute a trend.`
    };
  }

  const timeSeries = points.map((p, i) => ({
    season: p.season,
    value: p.value,
    delta: i === 0 ? null : Math.round((p.value - points[i - 1].value) * 100) / 100
  }));

  const deltas = timeSeries.slice(1).map((p) => p.delta);
  const meanValue = points.reduce((a, b) => a + b.value, 0) / points.length;
  const stableThreshold = Math.abs(meanValue) * STABLE_THRESHOLD_RATIO;

  const positive = deltas.filter((d) => d > 0).length;
  const negative = deltas.filter((d) => d < 0).length;
  const allStable = deltas.every((d) => Math.abs(d) < stableThreshold);

  let classification;
  if (allStable) {
    classification = 'Stable';
  } else if (positive / deltas.length >= 0.7) {
    classification = 'Improving';
  } else if (negative / deltas.length >= 0.7) {
    classification = 'Declining';
  } else {
    classification = 'Volatile';
  }

  const trendMagnitude = Math.round((deltas.reduce((a, b) => a + Math.abs(b), 0) / deltas.length) * 100) / 100;

  const recommendations = {
    Improving: `${indicator} is improving — continue current practices and monitor for consistency.`,
    Declining: `${indicator} is declining — investigate root causes and consider corrective action.`,
    Volatile: `${indicator} is volatile — collect additional seasons of data before drawing conclusions.`,
    Stable: `${indicator} is stable — no significant change detected across seasons.`
  };

  return {
    indicator,
    timeSeries,
    classification,
    trendMagnitude,
    recommendation: recommendations[classification]
  };
}

module.exports = { computeTrend, TRACKED_INDICATORS };
