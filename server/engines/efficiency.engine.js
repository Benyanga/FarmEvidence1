/**
 * Efficiency Engine — phase assignment + E_i(t,S) model, pure function.
 * See docs/COMPUTATION_ENGINE.md §3.
 */

const DEFAULT_E_MAX = 0.4;

/**
 * @param {number} seasonNumber
 * @param {number} adoptionStartSeason
 */
function resolvePhase(seasonNumber, adoptionStartSeason) {
  const seasonOffset = seasonNumber - adoptionStartSeason + 1;

  let phase;
  let phi;
  if (seasonOffset < 1) {
    phase = 'pre-adoption';
    phi = 0.0;
  } else if (seasonOffset <= 6) {
    phase = 'transition';
    phi = 0.3;
  } else if (seasonOffset <= 12) {
    phase = 'stabilization';
    phi = 0.7;
  } else {
    phase = 'mature';
    phi = 1.0;
  }

  return { phase, phi, seasonOffset };
}

/**
 * @param {object} params
 * @param {number} params.seasonNumber
 * @param {number} params.adoptionStartSeason
 * @param {number} params.csi - CSI(S) ∈ [0,1]
 * @param {number} [params.eMax]
 * @param {number} [params.qCF] - conventional-farming cost for the input category
 */
function computeEfficiency({ seasonNumber, adoptionStartSeason, csi, eMax = DEFAULT_E_MAX, qCF = 0 }) {
  const { phase, phi, seasonOffset } = resolvePhase(seasonNumber, adoptionStartSeason);

  const csiValue = csi ?? 0;
  const eiTS = eMax * phi * csiValue;
  const qCAi = qCF * (1 - eiTS);

  return {
    phase,
    phi,
    seasonOffset,
    eMax,
    eiTS: Math.round(eiTS * 10000) / 10000,
    qCAi: Math.round(qCAi * 100) / 100
  };
}

module.exports = { computeEfficiency, resolvePhase, DEFAULT_E_MAX };
