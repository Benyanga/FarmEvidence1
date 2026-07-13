import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import useCompute from '../../hooks/useCompute';
import ErrorAlert from '../../components/common/ErrorAlert';
import { formatRWF } from '../../utils/formatters';

const SCENARIOS = ['pessimistic', 'expected', 'optimistic'];
const DEFAULT_SHOCKS = {
  pessimistic: { priceShockPct: -20, wageShockPct: 20 },
  expected: { priceShockPct: 0, wageShockPct: 0 },
  optimistic: { priceShockPct: 20, wageShockPct: -20 }
};

function ScenarioTable({ scenarioName, data }) {
  const { t } = useTranslation();
  const labels = Object.keys(data || {});
  if (labels.length === 0) return null;

  return (
    <>
      <h6 className="mt-3">{t(`research.${scenarioName}`)}</h6>
      <Table hover responsive size="sm">
        <thead>
          <tr>
            <th>{t('trial.treatment')}</th>
            <th>{t('trial.newPrice')}</th>
            <th>{t('trial.newWage')}</th>
            <th>{t('cba.revenue')}</th>
            <th>{t('trial.cost')}</th>
            <th>{t('cba.grossMargin')}</th>
            <th>{t('cba.bcr')}</th>
            <th>{t('cba.roi')}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => {
            const s = data[label];
            return (
              <tr key={label}>
                <td>{label}</td>
                <td>{formatRWF(s.newPrice)}</td>
                <td>{formatRWF(s.newWage)}</td>
                <td>{formatRWF(s.revenue)}</td>
                <td>{formatRWF(s.cost)}</td>
                <td>{formatRWF(s.grossMargin)}</td>
                <td>{typeof s.bcr === 'number' ? s.bcr.toFixed(2) : '—'}</td>
                <td>{typeof s.roi === 'number' ? `${s.roi.toFixed(1)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}

/** §6.8 Sensitivity — default scenarios shown initially; editable shocks refresh via POST /trials/:trialId/sensitivity. */
export default function SensitivityPanel({ trialId, sensitivity: initial }) {
  const { t } = useTranslation();
  const { run, result, loading, error } = useCompute(`/trials/${trialId}/sensitivity`);
  const [shocks, setShocks] = useState(DEFAULT_SHOCKS);

  const current = result?.sensitivity || initial;

  const setShock = (scenario, field, value) => {
    setShocks((s) => ({ ...s, [scenario]: { ...s[scenario], [field]: Number(value) } }));
  };

  const refresh = async (e) => {
    e.preventDefault();
    await run(shocks).catch(() => {});
  };

  return (
    <>
      <ErrorAlert error={error} />

      <Form onSubmit={refresh} className="border rounded p-3 mb-3 bg-light">
        <p className="fw-bold mb-2">{t('trial.editShocks')}</p>
        <Row>
          {SCENARIOS.map((scenario) => (
            <Col xs={12} md={4} key={scenario}>
              <p className="mb-1 small text-muted">{t(`research.${scenario}`)}</p>
              <Row>
                <Col xs={6}>
                  <Form.Group className="mb-2">
                    <Form.Label className="small">{t('trial.priceShockPct')}</Form.Label>
                    <Form.Control
                      type="number"
                      value={shocks[scenario].priceShockPct}
                      onChange={(e) => setShock(scenario, 'priceShockPct', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col xs={6}>
                  <Form.Group className="mb-2">
                    <Form.Label className="small">{t('trial.wageShockPct')}</Form.Label>
                    <Form.Control
                      type="number"
                      value={shocks[scenario].wageShockPct}
                      onChange={(e) => setShock(scenario, 'wageShockPct', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Col>
          ))}
        </Row>
        <Button type="submit" size="sm" variant="success" disabled={loading}>
          {loading ? t('common.loading') : t('trial.recompute')}
        </Button>
      </Form>

      {current && (
        <>
          {SCENARIOS.map((scenario) => (
            <ScenarioTable key={scenario} scenarioName={scenario} data={current.scenarios?.[scenario]} />
          ))}
          <p className="mt-3">
            <Badge bg={current.rankingStable ? 'success' : 'warning'}>
              {current.rankingStable ? t('trial.rankingStable') : t('trial.rankingUnstable')}
            </Badge>
          </p>
          <p className="text-muted small">{current.interpretation}</p>
        </>
      )}
    </>
  );
}
