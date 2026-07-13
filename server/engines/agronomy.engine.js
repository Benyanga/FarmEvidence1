/**
 * Agronomy Engine — farm geometry and crop-population arithmetic, pure functions.
 */

/**
 * @param {object} params
 * @param {number} params.length - meters
 * @param {number} params.width - meters
 * @returns {number} area in m²
 */
function computeFarmArea({ length, width }) {
  if (typeof length !== 'number' || typeof width !== 'number') return null;
  return Math.round(length * width * 100) / 100;
}

/**
 * Plant population per hectare from row spacing and seeds per hill.
 * population/ha = (10,000 m² / (interRow_m × intraRow_m)) × seedsPerHill
 *
 * @param {object} params
 * @param {number} params.intraRow - cm, spacing between plants within a row
 * @param {number} params.interRow - cm, spacing between rows
 * @param {number} params.seedsPerHill
 * @returns {number|null} plants per hectare
 */
function computeCropPopulation({ intraRow, interRow, seedsPerHill }) {
  if (![intraRow, interRow, seedsPerHill].every((v) => typeof v === 'number' && v > 0)) {
    return null;
  }
  const intraRowM = intraRow / 100;
  const interRowM = interRow / 100;
  const population = (10000 / (intraRowM * interRowM)) * seedsPerHill;
  return Math.round(population);
}

module.exports = { computeFarmArea, computeCropPopulation };
