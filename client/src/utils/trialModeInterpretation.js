/**
 * Trial Mode (Researcher Mode) interpretation-generation engine.
 * Implements FarmEvidence_TrialMode_Report_Spec.md Section 3 as pure,
 * testable functions — no chart or PDF concerns live here.
 */

import { formatPValue } from './seasonalReportInterpretation';

const MINUS = '−';

function formatThousands(value, dp = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  const negative = value < 0;
  const [intPart, decPart] = Math.abs(value).toFixed(dp).split('.');
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const number = decPart ? `${withSeparators}.${decPart}` : withSeparators;
  return negative ? `${MINUS}${number}` : number;
}

function formatSignedPercent(value, dp = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  const sign = value < 0 ? MINUS : '+';
  return `${sign}${Math.abs(value).toFixed(dp)}%`;
}

function percentDifference(meanA, meanB) {
  if (typeof meanA !== 'number' || typeof meanB !== 'number' || meanB === 0) return null;
  return ((meanA - meanB) / Math.abs(meanB)) * 100;
}

// Whether a higher value is the economically favorable direction for each
// CBA indicator — drives the per-row "Superior System" tag (Section 2).
const HIGHER_IS_BETTER = {
  grossMargin: true,
  adjustedGrossMargin: true,
  bcr: true,
  roi: true,
  yield: true,
  netBenefit: true,
  costOfProductionPerKg: false,
  breakEvenYield: false,
  labourTime: false,
  labourCost: false
};

function indicatorSuperiority({ indicatorKey, treatmentA, treatmentB, meanA, meanB, higherIsBetter }) {
  const better = typeof higherIsBetter === 'boolean' ? higherIsBetter : HIGHER_IS_BETTER[indicatorKey];
  if (typeof better !== 'boolean' || typeof meanA !== 'number' || typeof meanB !== 'number' || meanA === meanB) {
    return { superior: null, label: 'No difference' };
  }
  const aWins = better ? meanA > meanB : meanA < meanB;
  const superior = aWins ? treatmentA : treatmentB;
  return { superior, label: `${superior} superior` };
}

/** Tags a cost-structure line item per Section 1 item 5. */
function costLineTag({ existsForA, existsForB, meanA, meanB, treatmentA, treatmentB }) {
  if (existsForA && !existsForB) return `${treatmentA}-specific`;
  if (existsForB && !existsForA) return `${treatmentB}-specific`;
  if (meanA === meanB) return 'Standardised';
  return 'Within-treatment variation';
}

/**
 * Section 3.1 — one paragraph directly under a results table.
 * Order: headline comparison, % difference, cost driver (if given), so-what.
 */
function interpretResultsTable({ metricLabel, unit, treatmentA, treatmentB, meanA, meanB, dp = 2, costDriverLabel = null, soWhat = null }) {
  const diff = meanA - meanB;
  const direction = diff >= 0 ? 'higher' : 'lower';
  const pctDiff = percentDifference(meanA, meanB);

  let sentence = `${treatmentA} recorded a ${direction} mean ${metricLabel} than ${treatmentB} ` +
    `(${formatThousands(meanA, dp)} vs ${formatThousands(meanB, dp)} ${unit}), a difference of ` +
    `${formatThousands(Math.abs(diff), dp)} ${unit}`;
  sentence += pctDiff !== null ? ` (${formatSignedPercent(pctDiff)}).` : '.';

  if (costDriverLabel) {
    sentence += ` This was driven primarily by ${costDriverLabel}.`;
  }
  if (soWhat) {
    sentence += ` ${soWhat}`;
  }

  return sentence;
}

/** Sorts cost/labour sub-line items by |difference|, largest first. */
function rankCostDrivers(costLines) {
  return costLines
    .map((line) => ({ ...line, absDiff: Math.abs(line.meanA - line.meanB) }))
    .filter((line) => line.absDiff > 0)
    .sort((a, b) => b.absDiff - a.absDiff);
}

/** Section 3.3 building block #2 — names and quantifies the largest cost/labour driver. */
function mechanismParagraph({ costLines, treatmentA, treatmentB, unit = 'RWF', dp = 2 }) {
  const ranked = rankCostDrivers(costLines);
  if (!ranked.length) return null;

  const top = ranked[0];
  const higherIsA = top.meanA > top.meanB;
  const higherTreatment = higherIsA ? treatmentA : treatmentB;
  const lowerTreatment = higherIsA ? treatmentB : treatmentA;
  const higherVal = higherIsA ? top.meanA : top.meanB;
  const lowerVal = higherIsA ? top.meanB : top.meanA;
  const pctReduction = higherVal !== 0 ? ((higherVal - lowerVal) / higherVal) * 100 : null;

  let sentence = `The largest single driver of this difference is ${top.label}: a mean of ` +
    `${formatThousands(lowerVal, dp)} ${unit} under ${lowerTreatment} compared to ` +
    `${formatThousands(higherVal, dp)} ${unit} under ${higherTreatment}`;
  if (pctReduction !== null) {
    sentence += `, a ${pctReduction.toFixed(1)}% reduction`;
  }
  sentence += '.';

  return sentence;
}

/**
 * Section 3.2 — explicit 95% CI direction check. Only meaningful when the
 * interval spans zero; compares |lower| vs |upper| to judge symmetry.
 */
function ciDirectionStatement(ci95, treatmentA, treatmentB) {
  if (!ci95 || typeof ci95.lower !== 'number' || typeof ci95.upper !== 'number') return null;
  const { lower, upper } = ci95;
  if (!(lower <= 0 && upper >= 0)) return null;

  const absLower = Math.abs(lower);
  const absUpper = Math.abs(upper);
  if (absLower === 0 || absUpper === 0) {
    const favored = absUpper === 0 ? treatmentB : treatmentA;
    return `the interval spans zero but is strongly asymmetric toward ${favored}`;
  }

  const ratio = Math.max(absLower, absUpper) / Math.min(absLower, absUpper);
  if (ratio < 1.25) {
    return 'the interval is roughly symmetric around zero';
  }
  const favored = absUpper > absLower ? treatmentA : treatmentB;
  const qualifier = ratio >= 2 ? 'strongly asymmetric' : 'asymmetric';
  return `the interval spans zero but is ${qualifier} toward ${favored}`;
}

/**
 * Section 3.2 — non-significance power caveat. Only applies below n = 15
 * per treatment; above that the effect size is stated plainly instead.
 */
function powerCaveatStatement({ significant, n, df }) {
  if (significant) return null;
  if (typeof n !== 'number' || n >= 15) return null;
  return `This reflects the study's statistical power constraint (n = ${n} per treatment, df = ${df}), not an absence of true treatment effect.`;
}

/**
 * Section 3.2 — full ANOVA/t-test interpretation sentence for one variable.
 * Significant results are stated plainly with no softening language;
 * non-significant results get the power caveat and explicit CI direction.
 */
function interpretStatisticalResult({ metricLabel, unit, treatmentA, treatmentB, meanA, meanB, dp = 2, tStat, df, pValue, significant, ci95, lsd, n }) {
  const diff = meanA - meanB;
  const direction = diff >= 0 ? 'higher' : 'lower';

  let sentence = `${treatmentA} had a ${direction} mean ${metricLabel} than ${treatmentB} ` +
    `(${formatThousands(meanA, dp)} vs ${formatThousands(meanB, dp)} ${unit}), a difference of ` +
    `${formatThousands(Math.abs(diff), dp)} ${unit} (t(${df}) = ${formatThousands(tStat, 2)}, ${formatPValue(pValue)}).`;

  if (significant) {
    sentence += ' This difference is highly significant at α = 0.05 — REJECT H0.';
    if (typeof lsd === 'number') {
      sentence += ` It exceeds the least significant difference (LSD = ${formatThousands(lsd, dp)}), confirming the treatments differ for this variable.`;
    }
  } else {
    sentence += ' This difference is not statistically significant at α = 0.05 — FAIL TO REJECT H0.';
    const caveat = powerCaveatStatement({ significant, n, df });
    if (caveat) sentence += ` ${caveat}`;
  }

  if (ci95 && typeof ci95.lower === 'number' && typeof ci95.upper === 'number') {
    const directionText = ciDirectionStatement(ci95, treatmentA, treatmentB) || 'the interval does not span zero';
    sentence += ` The 95% confidence interval (${formatThousands(ci95.lower, dp)} to ${formatThousands(ci95.upper, dp)}) — ${directionText}.`;
  }

  return sentence;
}

/**
 * Section 3.2 cross-metric coherence check / Section 3.3 building block #1.
 * metrics: [{ name, favors: <treatment label> | null }]
 * Only produces text when a clear majority (>= 5/6, generalized as a ratio)
 * favor the same treatment — never forced when metrics are mixed.
 */
function synthesisText(metrics, { minRatio = 5 / 6 } = {}) {
  const valid = (metrics || []).filter((m) => m && m.favors);
  if (!valid.length) return null;

  const counts = {};
  valid.forEach((m) => {
    counts[m.favors] = (counts[m.favors] || 0) + 1;
  });
  const [leader, leaderCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const total = valid.length;
  if (leaderCount / total < minRatio) return null;

  return `${leaderCount} of the ${total} independently measured outcome metrics favor ${leader}. ` +
    'This consistency across independently computed metrics is itself evidence of a real treatment effect: ' +
    'multiple concordant point estimates are less likely to arise under a true null than any single non-significant test considered alone.';
}

/** Section 3.3 building block #3 — names the one variable significant at p<0.05, if exactly one exists. */
function conclusiveResultStatement({ variables, partialBudget = null }) {
  const significant = (variables || []).filter((v) => typeof v.pValue === 'number' && v.pValue < 0.05);
  if (significant.length !== 1) return null;

  const v = significant[0];
  let sentence = `${v.name} is the one result where the statistical evidence is conclusive ` +
    `(${formatPValue(v.pValue)}), favoring ${v.favors}.`;

  if (partialBudget && typeof partialBudget.netChange === 'number') {
    const paysOff = partialBudget.netChange > 0;
    sentence += paysOff
      ? ` The partial budget shows a net gain of ${formatThousands(partialBudget.netChange, 0)} RWF, so this significant difference pays for itself through the resulting revenue/margin gain.`
      : ` The partial budget shows a net change of ${formatThousands(partialBudget.netChange, 0)} RWF, so this significant difference is not fully offset by the resulting revenue/margin gain.`;
  }

  return sentence;
}

/**
 * Section 3.3 building block #4 — blocks/replicates whose direction reverses
 * the overall treatment pattern. Never invents a causal explanation.
 */
function anomalyStatements({ overallFavors, blocks, treatmentA, treatmentB }) {
  return (blocks || [])
    .filter((b) => b.favors && b.favors !== overallFavors)
    .map((b) => {
      const other = b.favors === treatmentA ? treatmentB : treatmentA;
      const explanation = b.note ? b.note : 'no specific field observation was recorded that explains this';
      return `${b.label} reverses the overall pattern, showing ${b.favors} outperforming ${other} — ${explanation}.`;
    });
}

/** Section 3.3 building block #5 — does the favored treatment win under all three price/wage scenarios? */
function sensitivityRobustnessStatement({ favoredTreatment, scenarios }) {
  const entries = Object.entries(scenarios || {}).filter(([, winner]) => winner);
  if (!entries.length) return null;

  const holdsInAll = entries.every(([, winner]) => winner === favoredTreatment);
  if (holdsInAll) {
    return `${favoredTreatment}'s advantage holds under all three market scenarios (pessimistic, expected, and optimistic), making the result economically robust across plausible market fluctuations.`;
  }

  const reversals = entries.filter(([, winner]) => winner !== favoredTreatment).map(([scenario]) => scenario);
  return `${favoredTreatment}'s advantage does not hold under all scenarios — it reverses under the ${reversals.join(' and ')} scenario${reversals.length > 1 ? 's' : ''}, so this result is not robust to market fluctuations.`;
}

/** Section 1 item 9 — states whether RCBD blocking was informative. */
function blockEffectStatement({ significant, fValue, pValue }) {
  if (significant) {
    return `The block effect is significant (F = ${formatThousands(fValue, 2)}, ${formatPValue(pValue)}), indicating meaningful variation across blocks — blocking was informative and should be retained in future seasons.`;
  }
  return `The block effect is not significant (F = ${formatThousands(fValue, 2)}, ${formatPValue(pValue)}), indicating blocks did not explain meaningful variation — the design could be simplified (e.g. a fully randomized design) next season without a material loss of precision.`;
}

/** Section 1 item 7 — the exact df/t-critical footnote required under every descriptive-stats table. */
function descriptiveStatsFootnote({ tCritical, df }) {
  return `95% CI computed using t critical = ${formatThousands(tCritical, 3)}, df = ${df} (n1 + n2 − 2), two-tailed, α = 0.05.`;
}

/**
 * Section 3.3 — assembles the Results Discussion section's paragraphs, in
 * spec order, each included only when it applies to this trial's actual data.
 */
function buildResultsDiscussion({
  metrics = [],
  costLines = [],
  treatmentA,
  treatmentB,
  variables = [],
  partialBudget = null,
  overallFavors = null,
  blocks = [],
  favoredTreatment = null,
  scenarios = null
}) {
  const paragraphs = [];

  const synthesis = synthesisText(metrics);
  if (synthesis) paragraphs.push(synthesis);

  const mechanism = mechanismParagraph({ costLines, treatmentA, treatmentB });
  if (mechanism) paragraphs.push(mechanism);

  const conclusive = conclusiveResultStatement({ variables, partialBudget });
  if (conclusive) paragraphs.push(conclusive);

  anomalyStatements({ overallFavors, blocks, treatmentA, treatmentB }).forEach((s) => paragraphs.push(s));

  if (favoredTreatment && scenarios) {
    const robustness = sensitivityRobustnessStatement({ favoredTreatment, scenarios });
    if (robustness) paragraphs.push(robustness);
  }

  return paragraphs;
}

export {
  formatThousands,
  formatSignedPercent,
  percentDifference,
  indicatorSuperiority,
  costLineTag,
  interpretResultsTable,
  rankCostDrivers,
  mechanismParagraph,
  ciDirectionStatement,
  powerCaveatStatement,
  interpretStatisticalResult,
  synthesisText,
  conclusiveResultStatement,
  anomalyStatements,
  sensitivityRobustnessStatement,
  blockEffectStatement,
  descriptiveStatsFootnote,
  buildResultsDiscussion
};

const trialModeInterpretation = {
  formatThousands,
  formatSignedPercent,
  percentDifference,
  indicatorSuperiority,
  costLineTag,
  interpretResultsTable,
  rankCostDrivers,
  mechanismParagraph,
  ciDirectionStatement,
  powerCaveatStatement,
  interpretStatisticalResult,
  synthesisText,
  conclusiveResultStatement,
  anomalyStatements,
  sensitivityRobustnessStatement,
  blockEffectStatement,
  descriptiveStatsFootnote,
  buildResultsDiscussion
};

export default trialModeInterpretation;
