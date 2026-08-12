function roundValue(value, dp = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return value;
  return Number(value.toFixed(dp));
}

function formatNumber(value, dp = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  const rounded = roundValue(value, dp);
  return rounded.toFixed(dp);
}

function formatPValue(p) {
  if (typeof p !== 'number' || Number.isNaN(p)) return 'p = n/a';
  return p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(4)}`;
}

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

  let sentence = `${treatmentA} had a ${direction} mean ${metricLabel} than ${treatmentB} ` +
    `(${formatNumber(meanA, dp)} vs ${formatNumber(meanB, dp)} ${unit}), ` +
    `a difference of ${formatNumber(absDiff, dp)} ${unit}.`;

  if (tTest && tTest.canCompute !== false) {
    const { tStat, df, pValue, significant, ci95 } = tTest;
    sentence += ` This difference ${significant ? 'is' : 'is not'} statistically significant ` +
      `(t(${df}) = ${formatNumber(tStat, 2)}, ${formatPValue(pValue)}), at α = 0.05.`;

    if (significant && typeof lsd === 'number') {
      sentence += ' The observed difference exceeds the least significant difference ' +
        `(LSD = ${formatNumber(lsd, dp)}), confirming the treatments differ for this variable.`;
    } else if (!significant && ci95 && typeof ci95.lower === 'number' && typeof ci95.upper === 'number') {
      sentence += ` The 95% confidence interval (${formatNumber(ci95.lower, dp)} to ` +
        `${formatNumber(ci95.upper, dp)}) spans zero, so this could reflect the ` +
        'small sample size rather than a true absence of difference.';
    }
  }

  if (typeof replicatesPerTreatment === 'number' && replicatesPerTreatment < 5) {
    sentence += ' With fewer than 5 replicates per treatment, this trial has limited statistical power to detect real differences — treat this result as preliminary.';
  }

  return sentence;
}

function chartCaption({ metricLabel, unit, treatmentA, treatmentB, meanA, meanB, dp = 2 }) {
  const aLeads = meanA >= meanB;
  const leader = aLeads ? treatmentA : treatmentB;
  const direction = aLeads ? 'higher' : 'lower';

  return `Mean ${metricLabel} by treatment: ${treatmentA} ${formatNumber(meanA, dp)} ${unit} vs ` +
    `${treatmentB} ${formatNumber(meanB, dp)} ${unit} — ${leader} ${direction}.`;
}

function interpretFarmerSeason({ harvestKg, incomeRwf, profitRwf, priorSeasonProfitRwf = null, cooperativeAvgProfitRwf = null }) {
  let sentence = `This season you harvested ${formatNumber(harvestKg, 1)} kg and earned ${formatNumber(incomeRwf, 0)} RWF, leaving ${formatNumber(profitRwf, 0)} RWF profit after costs.`;

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

  return `Your costs were higher than last season mainly because of ${topCategory} (up ${formatNumber(topIncrease, 0)} RWF). Consider reviewing your ${topCategory} spending before next season.`;
}

export {
  formatNumber,
  formatPValue,
  interpretComparison,
  chartCaption,
  interpretFarmerSeason,
  generateFarmerRecommendation
};

const seasonalReportInterpretation = {
  formatNumber,
  formatPValue,
  interpretComparison,
  chartCaption,
  interpretFarmerSeason,
  generateFarmerRecommendation
};

export default seasonalReportInterpretation;
