/**
 * Scenario Engine — Best/Normal/Worst × CSI-weighted E[Profit], pure function.
 * See docs/COMPUTATION_ENGINE.md §6.
 */

const DEFAULT_ADJ = {
  bestYieldAdj: 0.15,
  bestPriceAdj: 0.1,
  bestCostAdj: -0.1,
  worstYieldAdj: -0.2,
  worstPriceAdj: -0.15,
  worstCostAdj: 0.15
};

const RAW_PROB = { best: 0.25, normal: 0.5, worst: 0.25 };

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {object} params
 * @param {number} params.yieldValue
 * @param {number} params.price
 * @param {number} params.cSystem
 * @param {number} params.csi ∈ [0,1]
 * @param {object} [params.overrides] - overrides for DEFAULT_ADJ
 */
function computeScenarios({ yieldValue, price, cSystem, csi = 0, overrides = {} }) {
  const adj = { ...DEFAULT_ADJ, ...overrides };

  const profitBest = round2(yieldValue * (1 + adj.bestYieldAdj) * (price * (1 + adj.bestPriceAdj)) - cSystem * (1 + adj.bestCostAdj));
  const profitNormal = round2(yieldValue * price - cSystem);
  const profitWorst = round2(yieldValue * (1 + adj.worstYieldAdj) * (price * (1 + adj.worstPriceAdj)) - cSystem * (1 + adj.worstCostAdj));

  const pBestRaw = RAW_PROB.best * (1 + csi);
  const pNormalRaw = RAW_PROB.normal;
  const pWorstRaw = RAW_PROB.worst * (1 + (1 - csi));
  const normalizer = pBestRaw + pNormalRaw + pWorstRaw;

  const pBest = pBestRaw / normalizer;
  const pNormal = pNormalRaw / normalizer;
  const pWorst = pWorstRaw / normalizer;

  const expectedProfit = round2(pBest * profitBest + pNormal * profitNormal + pWorst * profitWorst);

  return {
    scenarios: {
      best: { probability: round2(pBest), profit: profitBest },
      normal: { probability: round2(pNormal), profit: profitNormal },
      worst: { probability: round2(pWorst), profit: profitWorst }
    },
    expectedProfit,
    csiAdjustedWeights: { best: round2(pBest), normal: round2(pNormal), worst: round2(pWorst) }
  };
}

module.exports = { computeScenarios, DEFAULT_ADJ };
