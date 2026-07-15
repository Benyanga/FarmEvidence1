/**
 * Interpretation Engine — pure functions that turn computed statistical/CBA
 * results into plain-language sentences. Shared by the seasonal PDF report
 * generator and any in-app result summary (per the spec: "do not duplicate
 * the logic between the report generator and the dashboard") — this module
 * has no DB access and no report-format assumptions; callers pass
 * already-computed values and get a string back.
 *
 * See docs — FarmEvidence Seasonal Report Spec §4 for the rules this
 * implements. Two audiences, two functions, never mixed: §4.1 Researcher
 * Mode (statistical language, p-values, CIs) and §4.2 Farmer Mode (plain
 * comparative language, never a p-value or SD).
 */

const LOW_POWER_REPLICATE_THRESHOLD = 5;
const LOW_POWER_CAVEAT =
  'With fewer than 5 replicates per treatment, this trial has limited statistical power to detect real differences — treat this result as preliminary.';

function formatNumber(value, dp = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  return value.toFixed(dp);
}

/** §4.1 rule: exact p-values above 0.001, "p < 0.001" below that threshold. */
function formatPValue(p) {
  if (typeof p !== 'number' || Number.isNaN(p)) return 'p = n/a';
  return p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(4)}`;
}

/**
 * §4.1 Researcher Mode — one interpretation paragraph for a single response
 * variable, comparing exactly two treatments. Built entirely from the
 * values passed in; nothing here is hardcoded per-metric.
 *
 * @param {object} params
 * @param {string} params.metricLabel - e.g. "Yield", "Gross Margin", "C_SD Cost"
 * @param {string} params.unit - e.g. "kg", "RWF"
 * @param {string} params.treatmentA
 * @param {string} params.treatmentB
 * @param {number} params.meanA
 * @param {number} params.meanB
 * @param {number} [params.dp] - decimal places for displayed values (default 2)
 * @param {{tStat:number, df:number, pValue:number, significant:boolean, ci95:{lower:number,upper:number}, canCompute?:boolean}} [params.tTest]
 *   From computePooledTTest — omit/null if no test was run for this variable.
 * @param {number} [params.lsd] - least significant difference, from the ANOVA for this variable
 * @param {number} [params.replicatesPerTreatment] - triggers the low-power caveat when < 5 (§4.1 rule)
 * @returns {string}
 */
function interpretComparison({
  metricLabel,
  unit,
  treatmentA,
  treatmentB,
  meanA,
  meanB,
  dp = 2,
  tTest = null,
  lsd = null,
  replicatesPerTreatment = null
}) {
  const diff = meanA - meanB;
  const direction = diff >= 0 ? 'higher' : 'lower';
  const absDiff = Math.abs(diff);

  let sentence =
    `${treatmentA} had a ${direction} mean ${metricLabel} than ${treatmentB} ` +
    `(${formatNumber(meanA, dp)} vs ${formatNumber(meanB, dp)} ${unit}), ` +
    `a difference of ${formatNumber(absDiff, dp)} ${unit}.`;

  if (tTest && tTest.canCompute !== false) {
    const { tStat, df, pValue, significant, ci95 } = tTest;
    sentence +=
      ` This difference ${significant ? 'is' : 'is not'} statistically significant ` +
      `(t(${df}) = ${formatNumber(tStat, 2)}, ${formatPValue(pValue)}), at α = 0.05.`;

    if (significant && typeof lsd === 'number') {
      sentence +=
        ' The observed difference exceeds the least significant difference ' +
        `(LSD = ${formatNumber(lsd, dp)}), confirming the treatments differ for this variable.`;
    } else if (!significant && ci95 && typeof ci95.lower === 'number' && typeof ci95.upper === 'number') {
      sentence +=
        ` The 95% confidence interval (${formatNumber(ci95.lower, dp)} to ` +
        `${formatNumber(ci95.upper, dp)}) spans zero, so this could reflect the ` +
        'small sample size rather than a true absence of difference.';
    }
  }

  if (typeof replicatesPerTreatment === 'number' && replicatesPerTreatment < LOW_POWER_REPLICATE_THRESHOLD) {
    sentence += ` ${LOW_POWER_CAVEAT}`;
  }

  return sentence;
}

/**
 * §4.1 — one-line chart caption, independent of the full interpretation
 * paragraph, so a reader skimming charts only still gets the gist.
 */
function chartCaption({ metricLabel, unit, treatmentA, treatmentB, meanA, meanB, dp = 2 }) {
  const aLeads = meanA >= meanB;
  const leader = aLeads ? treatmentA : treatmentB;
  const direction = aLeads ? 'higher' : 'lower';
  return (
    `Mean ${metricLabel} by treatment: ${treatmentA} ${formatNumber(meanA, dp)} ${unit} vs ` +
    `${treatmentB} ${formatNumber(meanB, dp)} ${unit} — ${leader} ${direction}.`
  );
}

/**
 * §4.2 Farmer Mode — plain-language season summary. Never a p-value, SD, or
 * confidence interval. Comparison clauses are each their own sentence
 * (§4.2 rule: keep sentences short, break long explanations into two)
 * and are omitted entirely — not rendered as "no data" — when the input
 * they'd need doesn't exist, per the "never imply a trend from a single
 * point" rule.
 *
 * @param {object} params
 * @param {number} params.harvestKg
 * @param {number} params.incomeRwf
 * @param {number} params.profitRwf
 * @param {number} [params.priorSeasonProfitRwf] - omit/null if no prior season exists
 * @param {number} [params.cooperativeAvgProfitRwf] - omit/null if no benchmark exists
 * @returns {string}
 */
function interpretFarmerSeason({
  harvestKg,
  incomeRwf,
  profitRwf,
  priorSeasonProfitRwf = null,
  cooperativeAvgProfitRwf = null
}) {
  let sentence =
    `This season you harvested ${formatNumber(harvestKg, 1)} kg and earned ` +
    `${formatNumber(incomeRwf, 0)} RWF, leaving ${formatNumber(profitRwf, 0)} RWF profit after costs.`;

  if (typeof priorSeasonProfitRwf === 'number') {
    const change = profitRwf - priorSeasonProfitRwf;
    const base = Math.abs(priorSeasonProfitRwf);
    const pct = base > 0 ? Math.abs((change / base) * 100) : null;
    const moreOrLess = change >= 0 ? 'more' : 'less';
    const incOrDec = change >= 0 ? 'increase' : 'decrease';
    sentence += ` That is ${moreOrLess} than last season's ${formatNumber(priorSeasonProfitRwf, 0)} RWF profit`;
    sentence += pct !== null ? `, a ${formatNumber(pct, 0)}% ${incOrDec}.` : '.';
  }

  if (typeof cooperativeAvgProfitRwf === 'number') {
    sentence += ` Farmers in your cooperative averaged ${formatNumber(cooperativeAvgProfitRwf, 0)} RWF profit this season.`;
  }

  return sentence;
}

/**
 * §2.5 Farmer Mode — one actionable recommendation line, traced directly to
 * a recorded cost category (§4.2 rule: never suggest a practice that
 * wasn't actually recorded). Compares this season's cost categories
 * against the prior season's and names whichever grew the most in RWF.
 * Returns null — the caller omits the line entirely — when there's no
 * prior season to compare against, or nothing actually increased.
 *
 * @param {Object<string, number>} costByCategoryThisSeason - category name -> RWF total
 * @param {Object<string, number>} [costByCategoryPriorSeason] - same shape, prior season
 * @returns {string|null}
 */
function generateFarmerRecommendation(costByCategoryThisSeason, costByCategoryPriorSeason = null) {
  if (!costByCategoryPriorSeason) return null;

  let topCategory = null;
  let topIncrease = 0;
  for (const [category, amount] of Object.entries(costByCategoryThisSeason)) {
    const prior = costByCategoryPriorSeason[category] || 0;
    const increase = amount - prior;
    if (increase > topIncrease) {
      topIncrease = increase;
      topCategory = category;
    }
  }

  if (!topCategory) return null;

  return (
    `Your costs were higher than last season mainly because of ${topCategory} ` +
    `(up ${formatNumber(topIncrease, 0)} RWF). Consider reviewing your ${topCategory} spending before next season.`
  );
}

module.exports = {
  formatNumber,
  formatPValue,
  interpretComparison,
  chartCaption,
  interpretFarmerSeason,
  generateFarmerRecommendation,
  LOW_POWER_REPLICATE_THRESHOLD,
  LOW_POWER_CAVEAT
};
