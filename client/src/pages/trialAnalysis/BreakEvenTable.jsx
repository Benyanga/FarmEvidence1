import React from 'react';
import { useTranslation } from 'react-i18next';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import { formatRWF } from '../../utils/formatters';

const SAFETY_VARIANT = { Strong: 'success', Moderate: 'warning', Weak: 'danger' };

/** §6.7 Break-even analysis per treatment. */
export default function BreakEvenTable({ breakEven }) {
  const { t } = useTranslation();
  const labels = Object.keys(breakEven?.perTreatment || {});
  if (labels.length === 0) return <p className="text-muted">{t('common.noData')}</p>;

  return (
    <>
      <Table hover responsive size="sm" className="mb-2">
        <thead>
          <tr>
            <th>{t('trial.treatment')}</th>
            <th>{t('cba.breakEvenYield')} ({t('trial.perPlot')})</th>
            <th>{t('cba.breakEvenYield')} ({t('research.perHectare')})</th>
            <th>{t('cba.yieldMarginOfSafety')}</th>
            <th>{t('trial.breakEvenPrice')}</th>
            <th>{t('trial.priceMarginOfSafety')}</th>
            <th>{t('trial.safetyClassification')}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => {
            const b = breakEven.perTreatment[label];
            return (
              <tr key={label} className={label === breakEven.overallBest ? 'table-success' : undefined}>
                <td>
                  {label} {label === breakEven.overallBest && <Badge bg="success">{t('trial.overallBest')}</Badge>}
                </td>
                <td>{b.breakEvenYieldPlot ?? '—'} kg</td>
                <td>{b.breakEvenYieldHa ?? '—'} kg</td>
                <td>{typeof b.yieldMarginOfSafety === 'number' ? `${b.yieldMarginOfSafety}%` : '—'}</td>
                <td>{formatRWF(b.breakEvenPrice)}</td>
                <td>{typeof b.priceMarginOfSafety === 'number' ? `${b.priceMarginOfSafety}%` : '—'}</td>
                <td>
                  <Badge bg={SAFETY_VARIANT[b.yieldSafetyClassification] || 'secondary'}>{b.yieldSafetyClassification || '—'}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
