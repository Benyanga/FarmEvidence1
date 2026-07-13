import React from 'react';
import { useTranslation } from 'react-i18next';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import { VARIABLE_KEYS, variableLabel } from './variableLabels';

/** §6.5 Pooled t-test — only rendered when the trial has exactly 2 treatments. */
export default function TTestCard({ tTest }) {
  const { t } = useTranslation();
  if (!tTest) return null;

  return (
    <>
      <h6 className="mt-4">{t('statistics.tStat')} ({t('trial.tTest')})</h6>
      <Table hover responsive size="sm">
        <thead>
          <tr>
            <th>{t('trial.variable')}</th>
            <th>{t('trial.meanDiff')}</th>
            <th>{t('statistics.tStat')}</th>
            <th>df</th>
            <th>{t('statistics.pValue')}</th>
            <th>{t('statistics.ci95')}</th>
            <th>{t('research.decision')}</th>
          </tr>
        </thead>
        <tbody>
          {VARIABLE_KEYS.filter((v) => tTest[v]?.canCompute).map((variable) => {
            const tt = tTest[variable];
            return (
              <tr key={variable}>
                <td>{variableLabel(t, variable)}</td>
                <td>{tt.meanDiff}</td>
                <td>{tt.tStat}</td>
                <td>{tt.df}</td>
                <td>{tt.pValue}</td>
                <td>
                  [{tt.ci95.lower}, {tt.ci95.upper}]
                </td>
                <td>
                  <Badge bg={tt.significant ? 'success' : 'secondary'}>{tt.decision}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
