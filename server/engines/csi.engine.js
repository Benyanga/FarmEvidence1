/**
 * CSI Engine — Context Sensitivity Index, pure function.
 * See docs/COMPUTATION_ENGINE.md §2.
 */

const WEIGHTS = {
  j1: 0.25, // market access
  j2: 0.2, // climate reliability
  j3: 0.15, // soil quality
  j4: 0.15, // input availability
  j5: 0.15, // labor availability
  j6: 0.1 // institutional support
};

const DRIVER_LABELS = {
  j1: 'j1_marketAccess',
  j2: 'j2_climateReliability',
  j3: 'j3_soilQuality',
  j4: 'j4_inputAvailability',
  j5: 'j5_laborAvailability',
  j6: 'j6_institutionalSupport'
};

/**
 * @param {{j1:number,j2:number,j3:number,j4:number,j5:number,j6:number}} drivers
 */
function computeCSI(drivers) {
  const keys = Object.keys(WEIGHTS);
  const missing = keys.filter((k) => drivers[k] === undefined || drivers[k] === null);
  if (missing.length > 0) {
    return {
      csi: null,
      driverContributions: null,
      dominantDriver: null,
      weakestDriver: null,
      canCompute: false,
      missingData: missing.map((k) => DRIVER_LABELS[k])
    };
  }

  const driverContributions = {};
  let csi = 0;
  for (const k of keys) {
    const contribution = WEIGHTS[k] * drivers[k];
    driverContributions[k] = contribution;
    csi += contribution;
  }

  let dominantDriver = keys[0];
  let weakestDriver = keys[0];
  for (const k of keys) {
    if (driverContributions[k] > driverContributions[dominantDriver]) dominantDriver = k;
    if (driverContributions[k] < driverContributions[weakestDriver]) weakestDriver = k;
  }

  return {
    csi: Math.round(csi * 10000) / 10000,
    driverContributions,
    dominantDriver,
    weakestDriver,
    canCompute: true,
    missingData: []
  };
}

module.exports = { computeCSI, WEIGHTS, DRIVER_LABELS };
