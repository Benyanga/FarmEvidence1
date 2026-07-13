export const FARMING_SYSTEMS = ['CA', 'CF'];

export const SETUP_TYPES = {
  farm: 'farm',
  research_trial: 'research_trial'
};

export const RESEARCH_SETUP_TYPES = ['research_trial'];

export const INPUT_UNITS = ['kg', 'L', 'bunches'];

export const LABOR_UNITS = ['days', 'hours', 'minutes'];

export const AGRONOMIC_INDICATORS = [
  { key: 'biomassYield', unit: 'kg/ha' },
  { key: 'grainYield', unit: 'kg/ha' },
  { key: 'soilOrganicCarbon', unit: '%' },
  { key: 'soilMoisture', unit: '%' },
  { key: 'plantHeight', unit: 'cm' },
  { key: 'leafAreaIndex', unit: 'LAI' },
  { key: 'erosionScore', unit: 'score' },
  { key: 'soilScore', unit: 'score' },
  { key: 'earthwormCount', unit: 'count' },
  { key: 'weedPressureScore', unit: 'score' }
];

export const CSI_DRIVERS = [
  { key: 'j1_marketAccess', weight: 0.25 },
  { key: 'j2_climateReliability', weight: 0.2 },
  { key: 'j3_soilQuality', weight: 0.15 },
  { key: 'j4_inputAvailability', weight: 0.15 },
  { key: 'j5_laborAvailability', weight: 0.15 },
  { key: 'j6_institutionalSupport', weight: 0.1 }
];

export const PHASE_THRESHOLDS = {
  transition: { min: 1, max: 6, phi: 0.3 },
  stabilization: { min: 7, max: 12, phi: 0.7 },
  mature: { min: 13, max: Infinity, phi: 1.0 }
};

export const ROLES = ['farmer', 'researcher'];

export function isResearchSetup(setupType) {
  return RESEARCH_SETUP_TYPES.includes(setupType);
}
