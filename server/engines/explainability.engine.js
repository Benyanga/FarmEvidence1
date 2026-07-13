/**
 * Explainability Engine — WHAT/WHY/HOW/RECOMMENDATION for every computed result.
 * See docs/COMPUTATION_ENGINE.md §8. English only on the server; client translates via i18next.
 */

function fmtRWF(n) {
  if (typeof n !== 'number') return 'N/A';
  return `RWF ${Math.round(n).toLocaleString('en-US')}`;
}

function fmtPct(n) {
  if (typeof n !== 'number') return 'N/A';
  return `${Math.round(n * 100)}%`;
}

function explainProfit({ treatment, season, profit, revenue, cSystem, cBase, cSys, cTime, phase, phi, csi, missingData = [], isResearch = true }) {
  if (missingData.length > 0) {
    return {
      what: `Profit for ${treatment} in Season ${season} could not be computed.`,
      why: `Required observed data is missing: ${missingData.join(', ')}.`,
      how: isResearch
        ? 'Profit = Revenue (Yield × Price) − C_system (C_base + C_sys + C_time). All inputs must be observed field data.'
        : 'Profit = Revenue − Total Cost of Production. All inputs must be observed field data.',
      recommendation: `Collect the missing field(s) before profit can be computed: ${missingData.join(', ')}.`
    };
  }

  return {
    what: `The ${treatment} plot profit for Season ${season} is ${fmtRWF(profit)}/ha.`,
    why: isResearch
      ? `Revenue of ${fmtRWF(revenue)} ${revenue >= cSystem ? 'exceeded' : 'fell short of'} system costs of ${fmtRWF(cSystem)}, in the ${phase} phase (φ=${phi}) with CSI=${csi}.`
      : `Revenue of ${fmtRWF(revenue)} ${revenue >= cSystem ? 'exceeded' : 'fell short of'} the total cost of production of ${fmtRWF(cSystem)}.`,
    how: isResearch
      ? `Profit = Revenue − C_system. C_system = C_base (${fmtRWF(cBase)}) + C_sys (${fmtRWF(cSys)}) + C_time (${fmtRWF(cTime)}) = ${fmtRWF(cSystem)}.`
      : `Profit = Revenue − Total Cost of Production (${fmtRWF(cSystem)}).`,
    recommendation:
      profit >= 0
        ? 'Continue current practices and keep recording observed yield and price each season for trend accuracy.'
        : 'Profit is negative this season — review cost drivers (C_base breakdown) and confirm yield/price entries are accurate.'
  };
}

function explainAdoptionCost({ mode, adoptionCost, profitCA, profitCF, prevAdoptionCost }) {
  if (adoptionCost === null || adoptionCost === undefined) {
    return {
      what: 'Adoption cost could not be computed.',
      why: mode === 'research' ? 'Both a CA and a CF plot with observed profit are required for the same season.' : 'A system-change event with profit data before and after is required.',
      how: mode === 'research' ? 'AdoptionCost = max(0, Profit_CF − Profit_CA)' : 'AdoptionCost = max(0, Profit_prev − Profit_curr), computed only on system-change seasons.',
      recommendation: 'Ensure paired treatment data is recorded for this season.'
    };
  }

  if (adoptionCost === 0) {
    return {
      what: 'Adoption cost this season is RWF 0 — no economic penalty from adopting CA.',
      why: mode === 'research' ? `CA profit (${fmtRWF(profitCA)}) meets or exceeds CF profit (${fmtRWF(profitCF)}).` : 'Profit did not decline after the system change.',
      how: mode === 'research' ? 'AdoptionCost = max(0, Profit_CF − Profit_CA) = 0' : 'AdoptionCost = max(0, Profit_prev − Profit_curr) = 0',
      recommendation: 'CA has reached economic parity or better. Continue current practices.'
    };
  }

  const trendNote =
    typeof prevAdoptionCost === 'number' && prevAdoptionCost > adoptionCost
      ? ` Adoption cost is declining (was ${fmtRWF(prevAdoptionCost)} last season).`
      : '';

  return {
    what: `Adoption cost this season is ${fmtRWF(adoptionCost)}/ha.`,
    why: mode === 'research'
      ? `CA profit (${fmtRWF(profitCA)}) is still below CF profit (${fmtRWF(profitCF)}), meaning there is still an economic cost to having switched to CA.`
      : `Profit declined from ${fmtRWF(profitCF ?? null)} to ${fmtRWF(profitCA ?? null)} after the system change.`,
    how: mode === 'research'
      ? `AdoptionCost = max(0, Profit_CF − Profit_CA) = max(0, ${fmtRWF(profitCF)} − ${fmtRWF(profitCA)}) = ${fmtRWF(adoptionCost)}`
      : `AdoptionCost = max(0, Profit_prev − Profit_curr) = ${fmtRWF(adoptionCost)}`,
    recommendation: `${trendNote} Track profit each season to see if the gap continues to close.`.trim()
  };
}

function explainCSI({ csi, dominantDriver, weakestDriver, driverLabels }) {
  return {
    what: `The Context Sensitivity Index (CSI) for this season is ${csi} (on a 0–1 scale).`,
    why: `The strongest contributing factor was ${driverLabels[dominantDriver]}; the weakest was ${driverLabels[weakestDriver]}.`,
    how: 'CSI = 0.25·j1 + 0.20·j2 + 0.15·j3 + 0.15·j4 + 0.15·j5 + 0.10·j6 (market access, climate reliability, soil quality, input availability, labor availability, institutional support).',
    recommendation:
      csi < 0.3
        ? `CSI is critically low. Prioritize improving ${driverLabels[weakestDriver]} to raise overall context favorability.`
        : `Consider improving ${driverLabels[weakestDriver]} further to raise overall CSI.`
  };
}

function explainTTP({ ttp, hasEnoughData }) {
  if (!hasEnoughData) {
    return {
      what: 'Time-to-Profit (TTP) has not yet been reached.',
      why: 'At least 2 seasons of paired CA/CF profit data are required to evaluate TTP.',
      how: 'TTP = min{ t : Profit_CA(t) > Profit_CF(t) }, computed from observed data only.',
      recommendation: 'Continue recording both CA and CF plot profits each season.'
    };
  }

  if (ttp === null) {
    return {
      what: 'CA has not yet outperformed CF in profit.',
      why: 'Across all recorded seasons, CA profit has not exceeded CF profit in the same season.',
      how: 'TTP = min{ t : Profit_CA(t) > Profit_CF(t) }',
      recommendation: 'Continue monitoring — TTP will be recorded once CA profit surpasses CF profit for the first time.'
    };
  }

  return {
    what: `Time-to-Profit (TTP) was reached in Season ${ttp}.`,
    why: `Season ${ttp} is the first season in which CA profit exceeded CF profit.`,
    how: 'TTP = min{ t : Profit_CA(t) > Profit_CF(t) }, from observed seasonal data.',
    recommendation: 'CA has reached economic breakeven relative to CF. Continue tracking CNB to quantify cumulative benefit.'
  };
}

function explainCNB({ cnb }) {
  if (cnb === null) {
    return {
      what: 'Cumulative Net Benefit (CNB) could not be computed.',
      why: 'No seasons yet have complete paired CA/CF profit data.',
      how: 'CNB = Σ [Profit_CA(t) − Profit_CF(t)] for t = 1..T',
      recommendation: 'Record paired CA/CF plot profits each season to begin accumulating CNB.'
    };
  }

  return {
    what: `Cumulative Net Benefit (CNB) to date is ${fmtRWF(cnb)}/ha.`,
    why: cnb >= 0 ? 'CA has produced more cumulative profit than CF over the evaluated seasons.' : 'CF has produced more cumulative profit than CA so far over the evaluated seasons.',
    how: 'CNB = Σ [Profit_CA(t) − Profit_CF(t)] across all seasons with complete data.',
    recommendation: cnb >= 0 ? 'The cumulative evidence favors continued CA adoption.' : 'Monitor closely — cumulative evidence currently favors CF. Re-assess after more seasons.'
  };
}

function explainStatistical({ method, results }) {
  if (method === 't-test') {
    const { tStat, df, pValue, significant, cohenD, cohenDInterpretation } = results;
    return {
      what: `Treatments are ${significant ? '' : 'not '}significantly different at α=0.05.`,
      why: `Welch's t-test produced t=${tStat} (df=${df}, p=${pValue}), which is ${significant ? 'below' : 'above'} the 0.05 threshold.`,
      how: `Welch's t-test was used because equal variance was not assumed. Cohen's d = ${cohenD} (${cohenDInterpretation} effect).`,
      recommendation: significant
        ? `With p < 0.05 and a ${cohenDInterpretation} effect size, there is evidence the treatments produce meaningfully different outcomes. Replicate next season to confirm.`
        : 'No statistically significant difference was detected. Consider additional replications or seasons to increase statistical power.'
    };
  }

  const { fStat, pValue, significant, etaSquared, etaSquaredInterpretation, tukeyGroups } = results;
  return {
    what: `Treatment groups are ${significant ? '' : 'not '}significantly different at α=0.05.`,
    why: `One-way ANOVA produced F=${fStat} (p=${pValue}), which is ${significant ? 'below' : 'above'} the 0.05 threshold.`,
    how: `One-way ANOVA with Tukey HSD post-hoc grouping. η² = ${etaSquared} (${etaSquaredInterpretation} effect). Groups: ${JSON.stringify(tukeyGroups)}.`,
    recommendation: significant
      ? 'Review the Tukey letter groups to identify which specific treatment pairs differ significantly.'
      : 'No statistically significant difference was detected among treatments. Consider additional replications.'
  };
}

function explainTrend({ indicator, classification, trendMagnitude }) {
  const texts = {
    Improving: {
      what: `${indicator} is trending upward (Improving).`,
      why: `At least 70% of season-over-season changes were positive, with an average magnitude of ${trendMagnitude} per season.`,
      recommendation: 'Continue current practices that are driving this improvement.'
    },
    Declining: {
      what: `${indicator} is trending downward (Declining).`,
      why: `At least 70% of season-over-season changes were negative, with an average magnitude of ${trendMagnitude} per season.`,
      recommendation: 'Investigate the cause of the decline and consider corrective action.'
    },
    Volatile: {
      what: `${indicator} shows a volatile pattern across seasons.`,
      why: 'Changes alternate in direction without a consistent trend (less than 70% consistency).',
      recommendation: 'Collect more seasons of data before drawing firm conclusions.'
    },
    Stable: {
      what: `${indicator} is stable across seasons.`,
      why: 'Season-over-season changes remain within a small threshold of the mean value.',
      recommendation: 'No action needed unless a change in strategy is planned.'
    },
    Insufficient: {
      what: `${indicator} trend cannot yet be classified.`,
      why: 'Fewer than 2 seasons of data are available.',
      recommendation: `Record ${indicator} for at least one more season.`
    }
  };

  const t = texts[classification] || texts.Insufficient;
  return {
    what: t.what,
    why: t.why,
    how: 'Trend classification is based on the direction and consistency of Δ_X(t) = X(t) − X(t−1) across seasons.',
    recommendation: t.recommendation
  };
}

function explainScenario({ scenarios, expectedProfit, csi }) {
  return {
    what: `Expected profit across Best/Normal/Worst scenarios is ${fmtRWF(expectedProfit)}/ha.`,
    why: `CSI (${csi}) shifts probability weight toward the ${csi >= 0.5 ? 'best' : 'worst'} scenario (Best=${fmtPct(scenarios.best.probability)}, Normal=${fmtPct(scenarios.normal.probability)}, Worst=${fmtPct(scenarios.worst.probability)}).`,
    how: 'E[Profit] = Σ (CSI-adjusted probability × scenario profit), where scenario profit applies fixed yield/price/cost adjustments per scenario.',
    recommendation: csi < 0.4 ? 'The unfavorable context increases downside risk — consider risk-mitigation measures before the season.' : 'Context is favorable — expected profit reflects a reasonable balance of upside and downside risk.'
  };
}

module.exports = {
  explainProfit,
  explainAdoptionCost,
  explainCSI,
  explainTTP,
  explainCNB,
  explainStatistical,
  explainTrend,
  explainScenario
};
