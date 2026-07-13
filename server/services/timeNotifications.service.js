const Setup = require('../models/Setup');
const Season = require('../models/Season');
const Notification = require('../models/Notification');
const { notify } = require('./notification.service');

const DATA_ENTRY_DUE_DAYS = 14;

/**
 * Time-based notification sweep — run on login and via daily cron.
 * See docs/ARCHITECTURE.md §10.
 */
async function runTimeBasedSweep() {
  const setups = await Setup.find({ active: true });

  for (const setup of setups) {
    const seasons = await Season.find({ setupId: setup._id }).sort({ seasonNumber: -1 }).limit(1);
    const latest = seasons[0];
    if (!latest) continue;

    if (latest.status === 'draft') {
      const exists = await Notification.exists({
        userId: setup.ownerId,
        setupId: setup._id,
        seasonId: latest._id,
        type: 'season_start'
      });
      if (!exists) {
        await notify({
          userId: setup.ownerId,
          setupId: setup._id,
          seasonId: latest._id,
          type: 'season_start',
          title: 'Season ready to begin',
          message: `Season ${latest.seasonNumber} for "${setup.name}" is still in draft. Start data entry when the season begins.`,
          severity: 'info',
          actionLink: `/seasons/${latest._id}`
        });
      }
    }

    if (latest.status === 'in_progress') {
      const daysSinceUpdate = (Date.now() - new Date(latest.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate >= DATA_ENTRY_DUE_DAYS) {
        const exists = await Notification.exists({
          userId: setup.ownerId,
          setupId: setup._id,
          seasonId: latest._id,
          type: 'data_entry_due'
        });
        if (!exists) {
          await notify({
            userId: setup.ownerId,
            setupId: setup._id,
            seasonId: latest._id,
            type: 'data_entry_due',
            title: 'Data entry due',
            message: `No updates to Season ${latest.seasonNumber} for "${setup.name}" in over ${DATA_ENTRY_DUE_DAYS} days.`,
            severity: 'warning',
            actionLink: `/seasons/${latest._id}`
          });
        }
      }
    }
  }
}

module.exports = { runTimeBasedSweep };
