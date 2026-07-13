import React from 'react';
import { useTranslation } from 'react-i18next';
import Table from 'react-bootstrap/Table';
import { formatNumber } from '../../utils/formatters';
import { VARIABLE_KEYS, variableLabel } from './variableLabels';

/** §6.3 Descriptive Statistics — mean/SD/SE/95% CI/CV per treatment per variable. */
export default function DescriptiveStatsTable({ descriptiveStats }) {
  const { t } = useTranslation();
  if (!descriptiveStats) return <p className="text-muted">{t('common.noData')}</p>;

  return (
    <Table hover responsive size="sm">
      <thead>
        <tr>
          <th>{t('trial.variable')}</th>
          <th>{t('trial.treatment')}</th>
          <th>n</th>
          <th>{t('trial.mean')}</th>
          <th>{t('trial.sd')}</th>
          <th>{t('trial.se')}</th>
          <th>{t('statistics.ci95')}</th>
          <th>{t('statistics.cv')}</th>
        </tr>
      </thead>
      <tbody>
        {VARIABLE_KEYS.filter((v) => descriptiveStats[v]).map((variable) =>
          Object.entries(descriptiveStats[variable]).map(([label, s], i) => (
            <tr key={`${variable}-${label}`}>
              {i === 0 && (
                <td rowSpan={Object.keys(descriptiveStats[variable]).length} className="fw-bold align-middle">
                  {variableLabel(t, variable)}
                </td>
              )}
              <td>{label}</td>
              <td>{s.n}</td>
              <td>{formatNumber(s.mean)}</td>
              <td>{formatNumber(s.sd)}</td>
              <td>{formatNumber(s.se)}</td>
              <td>
                [{formatNumber(s.ci95?.lower)}, {formatNumber(s.ci95?.upper)}]
              </td>
              <td>
                {s.cv}% <span className="text-muted small">({s.cvInterpretation})</span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );
}
