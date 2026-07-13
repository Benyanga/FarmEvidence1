/** Shared display labels for the response-variable keys used across descriptiveStats/anova/tTest. */
export const VARIABLE_KEYS = ['yield', 'grossRevenue', 'totalProductionCost', 'cSD', 'cSI', 'netBenefit'];

export function variableLabel(t, key) {
  return t(`trial.variable_${key}`);
}
