/**
 * Statistical Engine — Research Mode only, pure functions, no DB access.
 * See docs/COMPUTATION_ENGINE.md §6.3–§6.5. Generic over t treatments x b
 * replicates/blocks (RCBD design) — not hardcoded to 2 treatments.
 */

const { jStat } = require('jstat');

function round(n, dp = 4) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function cvInterpretation(cv) {
  if (cv < 10) return 'excellent precision';
  if (cv < 20) return 'acceptable';
  return 'high variability — flag for review';
}

/**
 * Descriptive statistics for one treatment's replicate values — spec §6.3.
 * @param {{label:string, values:number[]}} treatment
 * @param {number} [alpha] - significance level, default 0.05
 */
function summarize({ label, values }, alpha = 0.05) {
  const n = values.length;
  const m = mean(values);
  const variance = n > 1 ? values.reduce((a, v) => a + (v - m) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const cv = m !== 0 ? (sd / m) * 100 : 0;
  const tCrit = n > 1 ? jStat.studentt.inv(1 - alpha / 2, n - 1) : 0;

  return {
    label,
    n,
    mean: round(m, 2),
    sd: round(sd, 2),
    se: round(se, 2),
    variance,
    cv: round(cv, 2),
    cvInterpretation: cvInterpretation(cv),
    ci95: { lower: round(m - tCrit * se, 2), upper: round(m + tCrit * se, 2) }
  };
}

/**
 * Compact letter display: treatments not significantly different (mean
 * difference <= threshold) share a letter. threshold is LSD (§6.4) or Tukey
 * HSD, whichever the caller is using. A trial can have any number of
 * treatments (a researcher picks t freely, not fixed) — this runs in
 * O(n²) worst case, not the O(2ⁿ) exhaustive-subset search an earlier
 * version used, which would have hung once t got much past ~20.
 *
 * Correctness note: because "not different" is defined by a single absolute
 * threshold on the mean difference, once treatments are sorted by mean this
 * relation is transitive within any contiguous run (if the two extremes of a
 * sorted run are within `threshold`, every pair inside the run is too) — so
 * maximal cliques are exactly the maximal contiguous runs. This is the
 * standard algorithm used by agronomy stats packages (e.g. R's `agricolae`)
 * for Tukey/LSD/Duncan letter displays.
 * @param {string[]} labels
 * @param {number[]} means - same order as labels
 * @param {number} threshold
 */
function computeCompactLetterGroups(labels, means, threshold) {
  const order = labels.map((label, i) => ({ label, mean: means[i] })).sort((a, b) => b.mean - a.mean);
  const n = order.length;

  const runs = [];
  let prevEnd = -1;
  for (let i = 0; i < n; i++) {
    let j = i;
    while (j + 1 < n && order[i].mean - order[j + 1].mean <= threshold) j += 1;
    if (j > prevEnd) {
      runs.push([i, j]);
      prevEnd = j;
    }
  }

  const groups = {};
  runs.forEach(([start, end], idx) => {
    const letter = String.fromCharCode(97 + idx); // a, b, c, ...
    for (let k = start; k <= end; k++) {
      groups[order[k].label] = (groups[order[k].label] || '') + letter;
    }
  });

  return groups;
}

/**
 * RCBD two-way ANOVA (Treatment x Block, no interaction term since each
 * block x treatment cell has a single replicate) — spec §6.4. Generic over
 * t treatments.
 * @param {Object<string, number[]>} valuesByTreatment - label -> values, one per block, same block order for every treatment
 * @param {number} [alpha]
 */
function computeRCBDAnova(valuesByTreatment, alpha = 0.05) {
  const labels = Object.keys(valuesByTreatment);
  const t = labels.length;
  const b = Math.min(...labels.map((l) => valuesByTreatment[l].length));

  if (t < 2 || b < 2) {
    return { canCompute: false, missingData: ['At least 2 treatments and 2 blocks/replicates are required.'] };
  }

  const matrix = labels.map((l) => valuesByTreatment[l].slice(0, b));

  const grandTotal = matrix.reduce((s, row) => s + row.reduce((a, v) => a + v, 0), 0);
  const N = t * b;
  const grandMean = grandTotal / N;
  const cf = grandTotal ** 2 / N;

  const ssTotal = matrix.reduce((s, row) => s + row.reduce((a, v) => a + v ** 2, 0), 0) - cf;

  const treatmentMeans = matrix.map((row) => mean(row));
  const treatmentTotals = matrix.map((row) => row.reduce((a, v) => a + v, 0));
  const ssTreatment = treatmentTotals.reduce((s, tot) => s + tot ** 2, 0) / b - cf;

  const blockTotals = [];
  for (let j = 0; j < b; j++) blockTotals.push(matrix.reduce((s, row) => s + row[j], 0));
  const blockMeans = blockTotals.map((tot) => tot / t);
  const ssBlock = blockTotals.reduce((s, tot) => s + tot ** 2, 0) / t - cf;

  const ssError = Math.max(0, ssTotal - ssTreatment - ssBlock);

  const dfTreatment = t - 1;
  const dfBlock = b - 1;
  const dfError = dfTreatment * dfBlock;
  const dfTotal = N - 1;

  const msTreatment = ssTreatment / dfTreatment;
  const msBlock = ssBlock / dfBlock;
  const msError = dfError > 0 ? ssError / dfError : 0;

  const fTreatment = msError > 0 ? msTreatment / msError : null;
  const fBlock = msError > 0 ? msBlock / msError : null;
  const pTreatment = fTreatment !== null ? round(1 - jStat.centralF.cdf(fTreatment, dfTreatment, dfError), 4) : null;
  const pBlock = fBlock !== null ? round(1 - jStat.centralF.cdf(fBlock, dfBlock, dfError), 4) : null;

  const cvPct = grandMean !== 0 ? round((Math.sqrt(msError) / grandMean) * 100, 2) : null;
  const tCritical = jStat.studentt.inv(1 - alpha / 2, dfError);
  const lsd = round(tCritical * Math.sqrt((2 * msError) / b), 2);

  const treatmentEffects = Object.fromEntries(labels.map((l, i) => [l, round(treatmentMeans[i] - grandMean, 2)]));
  const blockEffects = blockMeans.map((m, j) => ({ block: j + 1, effect: round(m - grandMean, 2) }));

  const treatmentSignificant = pTreatment !== null ? pTreatment <= alpha : null;
  const blockSignificant = pBlock !== null ? pBlock <= alpha : null;

  let letterGroups = null;
  if (treatmentSignificant) {
    letterGroups = computeCompactLetterGroups(labels, treatmentMeans, lsd);
  }

  const interpretation =
    `Treatment effect: ${treatmentSignificant ? 'Significant' : 'Not significant'} ` +
    `(F=${fTreatment !== null ? round(fTreatment) : 'n/a'}, p=${pTreatment ?? 'n/a'}). ` +
    `Block effect: ${blockSignificant ? 'Significant' : 'Not significant'} ` +
    `(F=${fBlock !== null ? round(fBlock) : 'n/a'}, p=${pBlock ?? 'n/a'}). ` +
    `RCBD ${blockSignificant ? 'did' : 'did not'} effectively control for spatial variability. ` +
    `CV = ${cvPct}%, LSD(${alpha}) = ${lsd}.`;

  return {
    canCompute: true,
    grandMean: round(grandMean, 2),
    grandTotal: round(grandTotal, 2),
    treatmentMeans: Object.fromEntries(labels.map((l, i) => [l, round(treatmentMeans[i], 2)])),
    blockMeans: blockMeans.map((m) => round(m, 2)),
    treatmentEffects,
    blockEffects,
    treatment: { ss: round(ssTreatment, 2), df: dfTreatment, ms: round(msTreatment, 2), f: fTreatment !== null ? round(fTreatment) : null, p: pTreatment, significant: treatmentSignificant },
    block: { ss: round(ssBlock, 2), df: dfBlock, ms: round(msBlock, 2), f: fBlock !== null ? round(fBlock) : null, p: pBlock, significant: blockSignificant },
    error: { ss: round(ssError, 2), df: dfError, ms: round(msError, 2) },
    total: { ss: round(ssTotal, 2), df: dfTotal },
    cv: cvPct,
    lsd,
    letterGroups,
    interpretation
  };
}

/**
 * One-way (CRD-style) ANOVA — treatment vs residual, ignoring block/replicate
 * grouping entirely (dfError = N−t, SS_Error = SS_Total − SS_Treatment).
 * Same output shape as computeRCBDAnova minus the block terms. For exactly 2
 * treatments this is mathematically identical to computePooledTTest's
 * F = t² (unlike computeRCBDAnova, whose block-adjusted error term only
 * coincides with the pooled t-test when block variance is negligible — see
 * §5.3's note in docs/COMPUTATION_ENGINE.md). Used as the primary
 * significance test in trialAnalysis.controller.js so the reported ANOVA and
 * t-test are always self-consistent regardless of block variance.
 * @param {Object<string, number[]>} valuesByTreatment - label -> values (any count per treatment)
 * @param {number} [alpha]
 */
function computeOneWayAnova(valuesByTreatment, alpha = 0.05) {
  const labels = Object.keys(valuesByTreatment);
  const t = labels.length;
  const counts = labels.map((l) => valuesByTreatment[l].length);
  const N = counts.reduce((a, n) => a + n, 0);

  if (t < 2 || counts.some((n) => n < 2)) {
    return { canCompute: false, missingData: ['At least 2 treatments with 2+ replicates each are required.'] };
  }

  const allValues = labels.flatMap((l) => valuesByTreatment[l]);
  const grandTotal = allValues.reduce((a, v) => a + v, 0);
  const grandMean = grandTotal / N;
  const cf = grandTotal ** 2 / N;

  const ssTotal = allValues.reduce((s, v) => s + v ** 2, 0) - cf;
  const treatmentTotals = labels.map((l) => valuesByTreatment[l].reduce((a, v) => a + v, 0));
  const treatmentMeans = treatmentTotals.map((tot, i) => tot / counts[i]);
  const ssTreatment = treatmentTotals.reduce((s, tot, i) => s + tot ** 2 / counts[i], 0) - cf;
  const ssError = Math.max(0, ssTotal - ssTreatment);

  const dfTreatment = t - 1;
  const dfError = N - t;
  const dfTotal = N - 1;

  const msTreatment = ssTreatment / dfTreatment;
  const msError = dfError > 0 ? ssError / dfError : 0;

  const fTreatment = msError > 0 ? msTreatment / msError : null;
  const pTreatment = fTreatment !== null ? round(1 - jStat.centralF.cdf(fTreatment, dfTreatment, dfError), 4) : null;

  const cvPct = grandMean !== 0 ? round((Math.sqrt(msError) / grandMean) * 100, 2) : null;
  const tCritical = jStat.studentt.inv(1 - alpha / 2, dfError);
  const bHarmonic = t / counts.reduce((s, n) => s + 1 / n, 0);
  const lsd = round(tCritical * Math.sqrt((2 * msError) / bHarmonic), 2);

  const treatmentEffects = Object.fromEntries(labels.map((l, i) => [l, round(treatmentMeans[i] - grandMean, 2)]));
  const treatmentSignificant = pTreatment !== null ? pTreatment <= alpha : null;

  let letterGroups = null;
  if (treatmentSignificant) {
    letterGroups = computeCompactLetterGroups(labels, treatmentMeans, lsd);
  }

  const interpretation =
    `Treatment effect: ${treatmentSignificant ? 'Significant' : 'Not significant'} ` +
    `(F=${fTreatment !== null ? round(fTreatment) : 'n/a'}, p=${pTreatment ?? 'n/a'}). ` +
    `CV = ${cvPct}%, LSD(${alpha}) = ${lsd}.`;

  return {
    canCompute: true,
    grandMean: round(grandMean, 2),
    grandTotal: round(grandTotal, 2),
    treatmentMeans: Object.fromEntries(labels.map((l, i) => [l, round(treatmentMeans[i], 2)])),
    treatmentEffects,
    treatment: {
      ss: round(ssTreatment, 2),
      df: dfTreatment,
      ms: round(msTreatment, 2),
      f: fTreatment !== null ? round(fTreatment) : null,
      p: pTreatment,
      significant: treatmentSignificant
    },
    error: { ss: round(ssError, 2), df: dfError, ms: round(msError, 2) },
    total: { ss: round(ssTotal, 2), df: dfTotal },
    cv: cvPct,
    lsd,
    letterGroups,
    interpretation
  };
}

/**
 * Independent-samples t-test for exactly 2 treatments, RCBD-paired-by-block
 * design (pooled variance, not Welch) — spec §6.5. Mathematically equivalent
 * to computeRCBDAnova's F-test for the same data (F = t²).
 * @param {{label:string, values:number[]}} treatmentA
 * @param {{label:string, values:number[]}} treatmentB
 * @param {number} [alpha]
 */
function computePooledTTest(treatmentA, treatmentB, alpha = 0.05) {
  const b = Math.min(treatmentA.values.length, treatmentB.values.length);
  if (b < 2) {
    return { canCompute: false, missingData: ['At least 2 paired blocks (replications) are required.'] };
  }
  const valuesA = treatmentA.values.slice(0, b);
  const valuesB = treatmentB.values.slice(0, b);

  const meanA = mean(valuesA);
  const meanB = mean(valuesB);
  const varA = valuesA.reduce((s, v) => s + (v - meanA) ** 2, 0) / (b - 1);
  const varB = valuesB.reduce((s, v) => s + (v - meanB) ** 2, 0) / (b - 1);

  const meanDiff = meanA - meanB;
  const pooledVariance = ((b - 1) * varA + (b - 1) * varB) / (2 * b - 2);
  const df = 2 * b - 2;
  const se = Math.sqrt(pooledVariance * (2 / b));
  const tStat = meanDiff / se;
  const pValue = round(2 * (1 - jStat.studentt.cdf(Math.abs(tStat), df)), 4);
  const tCritical = jStat.studentt.inv(1 - alpha / 2, df);

  return {
    canCompute: true,
    labels: [treatmentA.label, treatmentB.label],
    meanDiff: round(meanDiff, 2),
    pooledVariance: round(pooledVariance, 4),
    tStat: round(tStat),
    df,
    pValue,
    significant: pValue <= alpha,
    ci95: { lower: round(meanDiff - tCritical * se, 2), upper: round(meanDiff + tCritical * se, 2) },
    decision: pValue <= alpha ? `Significant (p<${alpha})` : `Not significant (p>${alpha})`
  };
}

/**
 * Cohen's d effect size for a pooled two-sample comparison, plus a
 * Small/Medium/Large magnitude label — derived from computePooledTTest's
 * own meanDiff/pooledVariance, never recomputed from raw values.
 * @param {{meanDiff:number, pooledVariance:number}} tTestResult
 */
function computeEffectSize({ meanDiff, pooledVariance }) {
  const pooledSD = Math.sqrt(pooledVariance);
  const d = pooledSD > 0 ? meanDiff / pooledSD : 0;
  const absD = Math.abs(d);
  const magnitude = absD < 0.5 ? 'Small' : absD < 0.8 ? 'Medium' : 'Large';
  return { d: round(d, 2), magnitude };
}

module.exports = {
  summarize,
  computeCompactLetterGroups,
  computeRCBDAnova,
  computeOneWayAnova,
  computePooledTTest,
  computeEffectSize
};
