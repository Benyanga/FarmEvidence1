/**
 * Cost Classifier — pure function, no DB access.
 * Auto-derives C_SD (System Dependent) vs C_SI (System Independent) from an
 * Input/Activity name, so farmers and researchers never have to pick a
 * classification by hand when filling in the Input Costs / Labour Costs
 * tables. Matches the cost taxonomy used in the CA-vs-CF closure report:
 * land prep, weeding, mulching are system-dependent (they differ between CA
 * and CF); seed, compost, NPK, planting and harvest labour are standardized
 * (system-independent) across both systems.
 */

const C_SD_KEYWORDS = ['land prep', 'landprep', 'till', 'plow', 'plough', 'weed', 'mulch'];
const C_SI_KEYWORDS = ['seed', 'compost', 'npk', 'fertiliz', 'fertilis', 'plant', 'harvest', 'pesticide', 'irrigat'];

/**
 * @param {string} name - inputName (Input Costs) or activity (Labour Costs)
 * @returns {'C_SD'|'C_SI'}
 */
function classifyCostItem(name) {
  const n = (name || '').toLowerCase();
  if (C_SD_KEYWORDS.some((k) => n.includes(k))) return 'C_SD';
  if (C_SI_KEYWORDS.some((k) => n.includes(k))) return 'C_SI';
  return 'C_SI';
}

module.exports = { classifyCostItem };
