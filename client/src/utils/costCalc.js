/**
 * Client-side previews mirroring the server engines exactly (laborcost.engine.js,
 * yieldLedger.engine.js) — used so a Data Entry row shows its Total Cost/Revenue
 * live as the farmer types, before the row is saved.
 */

export function computeInputRowTotal({ unitCost, quantity }) {
  const uc = Number(unitCost);
  const qty = Number(quantity);
  if (!(uc >= 0) || !(qty >= 0)) return null;
  return Math.round(uc * qty * 100) / 100;
}

export function computeLaborRowTotal({ timeTaken, unit, wageRatePerDay, workingHoursPerDay = 8 }) {
  const t = Number(timeTaken);
  const rate = Number(wageRatePerDay);
  if (!(t >= 0) || !(rate >= 0)) return null;
  if (unit === 'days') return Math.round(t * rate * 100) / 100;
  if (unit === 'hours') return Math.round(t * (rate / workingHoursPerDay) * 100) / 100;
  if (unit === 'minutes') return Math.round(t * (rate / (workingHoursPerDay * 60)) * 100) / 100;
  return null;
}

export function computeYieldRowPreview({ prevRemaining = 0, yieldHarvested, yieldSold, marketPrice }) {
  const harvested = Number(yieldHarvested) || 0;
  const sold = Number(yieldSold) || 0;
  const price = Number(marketPrice) || 0;
  const remainingYield = Math.round((prevRemaining + harvested - sold) * 100) / 100;
  const totalRevenue = Math.round(sold * price * 100) / 100;
  return { remainingYield, totalRevenue };
}

let localIdCounter = 0;
export function nextLocalId() {
  localIdCounter += 1;
  return `draft-${Date.now()}-${localIdCounter}`;
}
