import React from 'react';
import { useTranslation } from 'react-i18next';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';

const RISK_VARIANT = { 'Low risk': 'success', 'Moderate risk': 'warning', 'High risk': 'danger' };

function RiskTable({ title, data }) {
  const { t } = useTranslation();
  const labels = Object.keys(data?.perTreatment || {});
  if (labels.length === 0) return null;

  return (
    <>
      <h6>{title}</h6>
      <Table hover responsive size="sm" className="mb-2">
        <thead>
          <tr>
            <th>{t('trial.treatment')}</th>
            <th>{t('trial.mean')}</th>
            <th>{t('trial.sd')}</th>
            <th>{t('statistics.cv')}</th>
            <th>{t('trial.riskClassification')}</th>
            <th>{t('trial.min')}</th>
            <th>{t('trial.max')}</th>
            <th>{t('trial.median')}</th>
            <th>{t('trial.downsideRisk')}</th>
            <th>{t('trial.probBelowAverage')}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => {
            const r = data.perTreatment[label];
            return (
              <tr key={label}>
                <td>{label}</td>
                <td>{r.mean}</td>
                <td>{r.sd}</td>
                <td>{r.cv}%</td>
                <td>
                  <Badge bg={RISK_VARIANT[r.cvClassification] || 'secondary'}>{r.cvClassification}</Badge>
                </td>
                <td>{r.min}</td>
                <td>{r.max}</td>
                <td>{r.median}</td>
                <td>{r.downsideRiskPct}%</td>
                <td>{typeof r.probBelowAverage === 'number' ? `${Math.round(r.probBelowAverage * 100)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {data.pairwise && (
        <p className="text-muted small">
          {t('trial.lsd')}: {data.pairwise.lsd} — {data.pairwise.moreStable}
        </p>
      )}
    </>
  );
}

/** §6.6 Yield & Revenue stability/risk. */
export default function RiskStabilityView({ riskStability }) {
  const { t } = useTranslation();
  if (!riskStability) return <p className="text-muted">{t('common.noData')}</p>;

  return (
    <>
      <RiskTable title={t('plot.yield')} data={riskStability.yield} />
      <RiskTable title={t('cba.revenue')} data={riskStability.revenue} />
    </>
  );
}
