import React from 'react';
import { useTranslation } from 'react-i18next';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import { VARIABLE_KEYS, variableLabel } from './variableLabels';

/** §6.4 RCBD two-way ANOVA — one card per response variable. */
export default function AnovaTable({ anova }) {
  const { t } = useTranslation();
  if (!anova) return <p className="text-muted">{t('common.noData')}</p>;

  return (
    <>
      {VARIABLE_KEYS.filter((v) => anova[v]).map((variable) => {
        const a = anova[variable];
        if (!a.canCompute) {
          return (
            <Card key={variable} className="mb-3">
              <Card.Body>
                <Card.Title className="h6">{variableLabel(t, variable)}</Card.Title>
                <p className="text-muted small mb-0">{(a.missingData || []).join(', ')}</p>
              </Card.Body>
            </Card>
          );
        }
        return (
          <Card key={variable} className="mb-3">
            <Card.Body>
              <Card.Title className="h6 d-flex justify-content-between align-items-center">
                {variableLabel(t, variable)}
                <Badge bg={a.treatment.significant ? 'success' : 'secondary'}>
                  {a.treatment.significant ? t('statistics.significant') : t('common.no')}
                </Badge>
              </Card.Title>
              <Table size="sm" responsive className="mb-2">
                <thead>
                  <tr>
                    <th>{t('research.item')}</th>
                    <th>SS</th>
                    <th>df</th>
                    <th>MS</th>
                    <th>F</th>
                    <th>p</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t('research.treatmentEffect')}</td>
                    <td>{a.treatment.ss}</td>
                    <td>{a.treatment.df}</td>
                    <td>{a.treatment.ms}</td>
                    <td>{a.treatment.f ?? '—'}</td>
                    <td>{a.treatment.p ?? '—'}</td>
                  </tr>
                  {a.block && (
                    <tr>
                      <td>{t('research.blockEffect')}</td>
                      <td>{a.block.ss}</td>
                      <td>{a.block.df}</td>
                      <td>{a.block.ms}</td>
                      <td>{a.block.f ?? '—'}</td>
                      <td>{a.block.p ?? '—'}</td>
                    </tr>
                  )}
                  <tr>
                    <td>{t('trial.error')}</td>
                    <td>{a.error.ss}</td>
                    <td>{a.error.df}</td>
                    <td>{a.error.ms}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td>{t('common.total')}</td>
                    <td>{a.total.ss}</td>
                    <td>{a.total.df}</td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </Table>
              <p className="mb-1">
                {t('statistics.cv')}: {a.cv}% · {t('trial.lsd')}: {a.lsd}
              </p>
              {a.letterGroups && (
                <p className="mb-1">
                  {Object.entries(a.letterGroups)
                    .map(([label, letter]) => `${label} (${letter})`)
                    .join('  ·  ')}
                </p>
              )}
              <p className="text-muted small mb-0">{a.interpretation}</p>
            </Card.Body>
          </Card>
        );
      })}
    </>
  );
}
