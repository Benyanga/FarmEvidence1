export function formatRWF(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `RWF ${Math.round(value).toLocaleString('en-US')}`;
}

export function formatPercent(value, dp = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(dp)}%`;
}

export function formatNumber(value, dp = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: dp });
}

export function seasonLabel(season) {
  if (!season) return '—';
  return season.seasonLabel || `Season ${season.seasonCode || ''} ${season.year || ''}`.trim();
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
