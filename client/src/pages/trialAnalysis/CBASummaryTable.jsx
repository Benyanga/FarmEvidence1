import React from 'react';
import { useTranslation } from 'react-i18next';
import Table from 'react-bootstrap/Table';
import Alert from 'react-bootstrap/Alert';
import { formatRWF } from '../../utils/formatters';

/** §6.1 CBA Summary — per-treatment indicators (built from treatment means) + winner sentences. */
export default function CBASummaryTable({ summary, comparisons }) {
  const { t } = useTranslation();
  const labels = Object.keys(summary || {});

  if (labels.length === 0) return <p className="text-muted">{t('common.noData')}</p>;

  const rows = [
    { key: 'avgGrossRevenuePerPlot', label: t('trial.avgGrossRevenuePerPlot'), fmt: formatRWF },
    { key: 'avgGrossRevenuePerHa', label: t('trial.avgGrossRevenuePerHa'), fmt: formatRWF },
    { key: 'avgTotalProductionCost', label: t('trial.avgTotalProductionCost'), fmt: formatRWF },
    { key: 'netBenefit', label: t('trial.netBenefit'), fmt: formatRWF },
    { key: 'avgCSD', label: t('cost.C_SD'), fmt: formatRWF },
    { key: 'avgCSI', label: t('cost.C_SI'), fmt: formatRWF },
    { key: 'adjustedGrossMargin', label: t('cba.adjustedGrossMargin'), fmt: formatRWF },
    { key: 'bcr', label: t('cba.bcr'), fmt: (v) => (typeof v === 'number' ? v.toFixed(2) : '—') },
    { key: 'roi', label: t('cba.roi'), fmt: (v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '—') },
    { key: 'avgYieldPerPlot', label: t('trial.avgYieldPerPlot'), fmt: (v) => v ?? '—' },
    { key: 'avgYieldPerHa', label: t('trial.avgYieldPerHa'), fmt: (v) => v ?? '—' },
    { key: 'costPerKg', label: t('cba.costPerKg'), fmt: formatRWF }
  ];

  return (
    <>
      <Table hover responsive size="sm" className="mb-3">
        <thead>
          <tr>
            <th>{t('trial.indicator')}</th>
            {labels.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, fmt }) => (
            <tr key={key}>
              <td className="fw-bold">{label}</td>
              {labels.map((l) => (
                <td key={l}>{fmt(summary[l][key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>

      {(comparisons || []).map((c) => (
        <Alert key={c.metric} variant="light" className="border py-2">
          <strong>{c.metric}:</strong> {c.sentence}
        </Alert>
      ))}
    </>
  );
}
