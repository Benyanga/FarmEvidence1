const Notification = require('../models/Notification');

const PROFIT_THRESHOLD = 0;
const CSI_CRITICAL_THRESHOLD = 0.3;
const WORSENING_STREAK = 3;

async function notify({ userId, setupId, seasonId, type, title, message, severity = 'info', actionLink }) {
  return Notification.create({ userId, setupId, seasonId, type, title, message, severity, actionLink });
}

/**
 * Evaluates condition-based notification triggers after a season computation run.
 * See docs/ARCHITECTURE.md §10.
 */
async function checkConditionNotifications({ userId, setup, season, plots, trendSeries }) {
  const created = [];

  for (const plot of plots) {
    if (typeof plot.computed?.profit === 'number' && plot.computed.profit < PROFIT_THRESHOLD) {
      created.push(
        await notify({
          userId,
          setupId: setup._id,
          seasonId: season._id,
          type: 'profit_below_threshold',
          title: 'Profit below threshold',
          message: `${season.farmingSystem} plot profit for Season ${season.seasonNumber} is negative (RWF ${Math.round(plot.computed.profit).toLocaleString()}).`,
          severity: 'warning',
          actionLink: `/seasons/${season._id}/cba`
        })
      );
    }
    if (plot.computed?.missingData?.length > 0) {
      created.push(
        await notify({
          userId,
          setupId: setup._id,
          seasonId: season._id,
          type: 'missing_data',
          title: 'Missing data required for computation',
          message: `${season.farmingSystem} plot is missing: ${plot.computed.missingData.join(', ')}.`,
          severity: 'warning',
          actionLink: `/plots/${plot._id}`
        })
      );
    }
    if (typeof plot.computed?.ttp === 'number' && plot.computed.ttp === season.seasonNumber) {
      created.push(
        await notify({
          userId,
          setupId: setup._id,
          seasonId: season._id,
          type: 'ttp_milestone',
          title: 'Time-to-Profit milestone reached',
          message: `CA profit surpassed CF profit this season (Season ${season.seasonNumber}).`,
          severity: 'info',
          actionLink: `/seasons/${season._id}/cba`
        })
      );
    }
  }

  if (typeof season.computed?.csi === 'number' && season.computed.csi < CSI_CRITICAL_THRESHOLD) {
    created.push(
      await notify({
        userId,
        setupId: setup._id,
        seasonId: season._id,
        type: 'csi_critical',
        title: 'CSI critically low',
        message: `Context Sensitivity Index for Season ${season.seasonNumber} is ${season.computed.csi} (below 0.3).`,
        severity: 'alert',
        actionLink: `/seasons/${season._id}`
      })
    );
  }

  if (trendSeries && trendSeries.length >= WORSENING_STREAK) {
    const recent = trendSeries.slice(-WORSENING_STREAK);
    const worsening = recent.every((v, i) => (i === 0 ? true : v < recent[i - 1]));
    if (worsening) {
      created.push(
        await notify({
          userId,
          setupId: setup._id,
          seasonId: season._id,
          type: 'trend_worsening',
          title: 'Trend worsening',
          message: `Profit has declined for ${WORSENING_STREAK} consecutive seasons.`,
          severity: 'alert',
          actionLink: `/trends/${setup._id}`
        })
      );
    }
  }

  return created;
}

module.exports = { notify, checkConditionNotifications };
