const Setup = require('../models/Setup');
const Season = require('../models/Season');
const Plot = require('../models/Plot');
const Trial = require('../models/Trial');
const TrialPlot = require('../models/TrialPlot');

const RESEARCH_SETUP_TYPES = ['research_trial'];

/**
 * modeGuard({ from: 'season' | 'setup' | 'plot' | 'trial' | 'trialPlot', param: ':paramName', require: 'research' })
 *
 * Resolves the Setup document from a route param and enforces that its
 * setupType matches the required mode before allowing the request through.
 * Mode is DERIVED from setupType — never stored explicitly. See ARCHITECTURE.md §4.2.
 */
function modeGuard({ from = 'setup', param, require: requiredMode = 'research' } = {}) {
  return async (req, res, next) => {
    try {
      const id = req.params[param];
      if (!id) {
        return res.status(400).json({
          error: { code: 'MISSING_PARAM', message: `Route parameter "${param}" is required.` }
        });
      }

      let setup;
      if (from === 'setup') {
        setup = await Setup.findById(id);
      } else if (from === 'season') {
        const season = await Season.findById(id);
        if (!season) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found.' } });
        }
        setup = await Setup.findById(season.setupId);
      } else if (from === 'plot') {
        const plot = await Plot.findById(id);
        if (!plot) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plot not found.' } });
        }
        setup = await Setup.findById(plot.setupId);
      } else if (from === 'trial') {
        const trial = await Trial.findById(id);
        if (!trial) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial not found.' } });
        }
        setup = await Setup.findById(trial.setupId);
      } else if (from === 'trialPlot') {
        const trialPlot = await TrialPlot.findById(id);
        if (!trialPlot) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial plot not found.' } });
        }
        const trial = await Trial.findById(trialPlot.trialId);
        if (!trial) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial not found.' } });
        }
        setup = await Setup.findById(trial.setupId);
      }

      if (!setup) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup not found.' } });
      }

      const isResearch = RESEARCH_SETUP_TYPES.includes(setup.setupType);
      const mode = isResearch ? 'research' : 'farmer';

      if (mode !== requiredMode) {
        return res.status(403).json({
          error: {
            code: 'MODE_FORBIDDEN',
            message: `This feature requires ${requiredMode === 'research' ? 'Research Mode (research_trial setup)' : 'Farmer Mode'}. This setup is in ${mode} mode.`
          }
        });
      }

      req.mode = mode;
      req.setup = setup;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = modeGuard;
