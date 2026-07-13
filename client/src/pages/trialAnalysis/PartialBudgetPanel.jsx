import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import Alert from 'react-bootstrap/Alert';
import useCompute from '../../hooks/useCompute';
import ErrorAlert from '../../components/common/ErrorAlert';
import { formatRWF } from '../../utils/formatters';

/** §6.9 Partial Budget — baseline -> alternative switching analysis. */
export default function PartialBudgetPanel({ trialId, treatments }) {
  const { t } = useTranslation();
  const { run, result, loading, error } = useCompute(`/trials/${trialId}/partial-budget`);
  const [baselineId, setBaselineId] = useState(treatments[0]?._id || '');
  const [alternativeId, setAlternativeId] = useState(treatments[1]?._id || '');

  const submit = async (e) => {
    e.preventDefault();
    await run({ baselineTreatmentId: baselineId, alternativeTreatmentId: alternativeId }).catch(() => {});
  };

  const budget = result?.partialBudget;

  return (
    <>
      <ErrorAlert error={error} />
      <Form onSubmit={submit} className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <Form.Group>
          <Form.Label className="small mb-0">{t('trial.baseline')}</Form.Label>
          <Form.Select value={baselineId} onChange={(e) => setBaselineId(e.target.value)} style={{ minWidth: 180 }}>
            {treatments.map((tr) => (
              <option key={tr._id} value={tr._id}>
                {tr.code} — {tr.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group>
          <Form.Label className="small mb-0">{t('trial.alternative')}</Form.Label>
          <Form.Select value={alternativeId} onChange={(e) => setAlternativeId(e.target.value)} style={{ minWidth: 180 }}>
            {treatments.map((tr) => (
              <option key={tr._id} value={tr._id}>
                {tr.code} — {tr.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Button type="submit" size="sm" variant="success" disabled={loading || baselineId === alternativeId}>
          {loading ? t('common.loading') : t('trial.compute')}
        </Button>
      </Form>

      {budget && (
        <>
          <Table size="sm" responsive className="mb-2">
            <thead>
              <tr>
                <th>{t('research.additionalBenefits')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {budget.benefitLines.map((line) => (
                <tr key={line.item}>
                  <td>{line.item}</td>
                  <td>{formatRWF(line.amount)}</td>
                </tr>
              ))}
              <tr className="fw-bold table-light">
                <td>{t('common.total')}</td>
                <td>{formatRWF(budget.additionalBenefits)}</td>
              </tr>
            </tbody>
          </Table>

          <Table size="sm" responsive className="mb-2">
            <thead>
              <tr>
                <th>{t('research.additionalCosts')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {budget.costLines.map((line) => (
                <tr key={line.item}>
                  <td>{line.item}</td>
                  <td>{formatRWF(line.amount)}</td>
                </tr>
              ))}
              <tr className="fw-bold table-light">
                <td>{t('common.total')}</td>
                <td>{formatRWF(budget.additionalCosts)}</td>
              </tr>
            </tbody>
          </Table>

          <p>
            <strong>{t('research.netChange')}:</strong> {formatRWF(budget.netChange)}{' '}
            {typeof budget.netChangePerHa === 'number' && <>({formatRWF(budget.netChangePerHa)} /ha)</>}
          </p>
          {typeof budget.returnPerInvested === 'number' && (
            <p>
              <strong>{t('research.returnPerInvested')}:</strong> {budget.returnPerInvested}
            </p>
          )}

          <Alert variant={budget.netChange > 0 ? 'success' : 'warning'}>{budget.recommendation}</Alert>
        </>
      )}
    </>
  );
}
