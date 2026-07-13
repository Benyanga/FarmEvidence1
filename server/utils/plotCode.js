/**
 * Generated plot identity — e.g. "CAR1", "CFR3". Treatment codes are always
 * CA/CF (see Treatment model), so this is a pure format, never stored.
 */
function getPlotCode(treatmentCode, replicateNumber) {
  return `${treatmentCode}R${replicateNumber}`;
}

module.exports = { getPlotCode };
