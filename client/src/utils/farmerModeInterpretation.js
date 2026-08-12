/**
 * Farmer Mode interpretation-generation engine.
 * Implements FarmEvidence_FarmerMode_Report_Spec.md Section 3.3/3.4/3.5/3.6
 * and Section 4's rules, as pure, testable functions — no chart or PDF
 * concerns live here. This is a bookkeeping/profitability report for one
 * farmer's own season: the other farming system never appears as a
 * comparator (Section 4, rule 1), and there is no statistics vocabulary.
 */

import { formatThousands } from './trialModeInterpretation';

function formatRWF(value) {
  return `${formatThousands(value, 0)} RWF`;
}

// Mirrors server/engines/costClassifier.engine.js's C_SI keyword set for the
// farmer-facing categories that actually matter to a farmer's bookkeeping —
// Labour is handled separately (the whole LaborRecord ledger), not by name.
const SEED_KEYWORDS = ['seed'];
const FERTILISER_KEYWORDS = ['compost', 'npk', 'fertiliz', 'fertilis'];

/** Section 3.3 — buckets a CostRecord's inputName into a farmer-recognisable category (never C_SD/C_SI). */
function categorizeCostItem(inputName) {
  const n = (inputName || '').toLowerCase();
  if (SEED_KEYWORDS.some((k) => n.includes(k))) return 'Seeds';
  if (FERTILISER_KEYWORDS.some((k) => n.includes(k))) return 'Fertiliser/Compost';
  return 'Other Inputs';
}

/**
 * Section 3.3 — rolls raw CostRecord rows + the labour ledger total into the
 * four farmer-facing categories, sorted largest first.
 * inputCosts: [{ inputName, totalCost }]
 */
function buildCostCategories({ inputCosts = [], laborCostTotal = 0 }) {
  const totals = { Seeds: 0, 'Fertiliser/Compost': 0, 'Other Inputs': 0 };
  inputCosts.forEach((c) => {
    const category = categorizeCostItem(c.inputName);
    totals[category] += c.totalCost || 0;
  });
  if (laborCostTotal > 0) totals.Labour = laborCostTotal;

  return Object.entries(totals)
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Section 3.3 interpretation line — names the single largest cost category and its share. */
function costCategoryInterpretation(categories) {
  if (!categories.length) return null;
  const total = categories.reduce((s, c) => s + c.value, 0);
  const top = categories[0];
  const pct = total > 0 ? (top.value / total) * 100 : 0;
  return `Your largest cost this season was ${top.label} at ${pct.toFixed(0)}% of total spending.`;
}

/** Section 3.2 — the fixed headline sentence under the four stat cards. */
function seasonAtAGlanceSummary({ harvestKg, crop, revenue, cost, profit }) {
  const cropText = crop ? ` of ${crop}` : '';
  return `This season you harvested ${formatThousands(harvestKg, 1)} kg${cropText} and earned ${formatRWF(revenue)} in revenue. After ${formatRWF(cost)} in costs, your net profit was ${formatRWF(profit)}.`;
}

/**
 * Section 3.4 — one fixed plain-language template per profitability
 * indicator. Wording stays consistent season to season by design.
 */
function interpretProfitabilityIndicator(key, { value, actualYield, breakEvenYield } = {}) {
  switch (key) {
    case 'netProfitPerPlot':
      return typeof value === 'number' ? `This is what you earned this season after all recorded costs.` : null;
    case 'netProfitPerHa':
      return typeof value === 'number' ? `This is your net profit scaled to a full hectare, for comparison across plot sizes.` : null;
    case 'bcr':
      return typeof value === 'number' ? `For every 1 RWF you spent, you earned ${value.toFixed(2)} RWF back.` : null;
    case 'costPerKg':
      return typeof value === 'number' ? `It cost you ${formatRWF(value)} to produce each kilogram.` : null;
    case 'breakEvenYield': {
      if (typeof value !== 'number' || typeof actualYield !== 'number') return null;
      const diff = actualYield - value;
      const direction = diff >= 0 ? 'above' : 'below';
      return `You needed to harvest at least ${formatThousands(value, 1)} kg to cover your costs; you harvested ${formatThousands(actualYield, 1)} kg, so you were ${direction} break-even by ${formatThousands(Math.abs(diff), 1)} kg.`;
    }
    default:
      return null;
  }
}

/** Ranks cost line items by |season-over-season % change|, largest first — used to name the fastest-growing item. */
function rankCostItemsByChange(currentItems, priorItems) {
  const priorByName = new Map(priorItems.map((i) => [i.label, i.value]));
  return currentItems
    .map((item) => {
      const prior = priorByName.get(item.label) || 0;
      const pctChange = prior > 0 ? ((item.value - prior) / prior) * 100 : item.value > 0 ? Infinity : 0;
      return { ...item, priorValue: prior, pctChange };
    })
    .filter((item) => item.pctChange > 0)
    .sort((a, b) => b.pctChange - a.pctChange);
}

/**
 * Section 3.6 — "What This Means for You": one profitability synthesis
 * sentence plus one traceable recommendation. Never suggests switching
 * farming system (out of scope for Farmer Mode per spec).
 */
function whatThisMeansParagraph({ profit, currentItems = [], priorItems = null }) {
  const paragraphs = [];

  if (typeof profit === 'number') {
    paragraphs.push(
      profit >= 0
        ? `Your season was profitable, earning ${formatRWF(profit)} net after costs.`
        : `Your season recorded a net loss of ${formatRWF(Math.abs(profit))} after costs.`
    );
  }

  if (priorItems && priorItems.length) {
    const risers = rankCostItemsByChange(currentItems, priorItems);
    if (risers.length) {
      const top = risers[0];
      paragraphs.push(`Your ${top.label} cost rose sharply this season, up ${top.pctChange.toFixed(0)}% — consider reviewing ${top.label} spending before next season.`);
      return paragraphs;
    }
  }

  if (currentItems.length) {
    const top = [...currentItems].sort((a, b) => b.value - a.value)[0];
    paragraphs.push(`Your largest single cost this season was ${top.label} at ${formatRWF(top.value)}. Review this if you'd like to reduce costs next season.`);
  }

  return paragraphs;
}

/**
 * Section 3.5 — "How This Season Compares", one clear branch per case, per
 * spec's explicit instruction not to write one generic sentence covering all
 * cases. Returns null when the section should be omitted entirely (no prior
 * season and no cooperative benchmark).
 */
function seasonComparisonParagraph({ currentSystem, currentProfit, priorSeasons = [], cooperativeAvgProfit = null }) {
  // priorSeasons: [{ season, farmingSystem, profit }], most recent first.
  if (!priorSeasons.length) {
    if (typeof cooperativeAvgProfit === 'number') {
      return `Farmers in your cooperative averaged ${formatRWF(cooperativeAvgProfit)} net profit this season; you earned ${formatRWF(currentProfit)}.`;
    }
    return null;
  }

  const immediatePrior = priorSeasons[0];
  const pctChange = immediatePrior.profit ? ((currentProfit - immediatePrior.profit) / Math.abs(immediatePrior.profit)) * 100 : null;
  const direction = currentProfit >= immediatePrior.profit ? 'higher' : 'lower';

  if (immediatePrior.farmingSystem === currentSystem) {
    let sentence = `Your net profit this season was ${formatRWF(currentProfit)}, ${pctChange !== null ? `${Math.abs(pctChange).toFixed(0)}% ` : ''}${direction} than last season's ${formatRWF(immediatePrior.profit)}.`;

    // "Three or more seasons of the same system" trend statement — never a stronger claim than direction.
    const sameSystemRun = [{ season: null, farmingSystem: currentSystem, profit: currentProfit }];
    for (const s of priorSeasons) {
      if (s.farmingSystem !== currentSystem) break;
      sameSystemRun.push(s);
      if (sameSystemRun.length === 3) break;
    }
    if (sameSystemRun.length >= 3) {
      const oldest = sameSystemRun[sameSystemRun.length - 1].profit;
      const newest = sameSystemRun[0].profit;
      const changePct = oldest !== 0 ? ((newest - oldest) / Math.abs(oldest)) * 100 : 0;
      const trend = Math.abs(changePct) < 5 ? 'stayed roughly level' : changePct > 0 ? 'risen' : 'fallen';
      sentence += ` Over your last ${sameSystemRun.length} seasons, your net profit has ${trend}.`;
    }
    return sentence;
  }

  return (
    `You farmed under ${currentSystem} this season, compared to ${immediatePrior.farmingSystem} last season. ` +
    `Your net profit was ${formatRWF(currentProfit)} this season versus ${formatRWF(immediatePrior.profit)} last season. ` +
    'Many factors can affect profit season to season, including which system was used, so treat this as your own record rather than a controlled comparison.'
  );
}

export {
  categorizeCostItem,
  buildCostCategories,
  costCategoryInterpretation,
  seasonAtAGlanceSummary,
  interpretProfitabilityIndicator,
  rankCostItemsByChange,
  whatThisMeansParagraph,
  seasonComparisonParagraph
};

const farmerModeInterpretation = {
  categorizeCostItem,
  buildCostCategories,
  costCategoryInterpretation,
  seasonAtAGlanceSummary,
  interpretProfitabilityIndicator,
  rankCostItemsByChange,
  whatThisMeansParagraph,
  seasonComparisonParagraph
};

export default farmerModeInterpretation;
