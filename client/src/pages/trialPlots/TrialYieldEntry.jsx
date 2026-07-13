import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import api from '../../services/api';
import ErrorAlert from '../../components/common/ErrorAlert';
import { formatRWF } from '../../utils/formatters';

/**
 * Research Mode only — single Yield & Revenue entry per plot (upsert), not a
 * running ledger like Farmer Mode's YieldEntry. priceRwfPerKg defaults from
 * the Trial's marketPriceRwfPerKg if left blank.
 */
export default function TrialYieldEntry({ trialPlotId, trial, yieldEntry, onChanged }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ yieldKg: '', priceRwfPerKg: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm({
      yieldKg: yieldEntry?.yieldKg ?? '',
      priceRwfPerKg: yieldEntry?.priceRwfPerKg ?? trial?.marketPriceRwfPerKg ?? ''
    });
  }, [yieldEntry, trial]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.put(`/trial-plots/${trialPlotId}/yield`, {
        yieldKg: Number(form.yieldKg),
        priceRwfPerKg: form.priceRwfPerKg ? Number(form.priceRwfPerKg) : undefined
      });
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <Form onSubmit={save}>
        <Row>
          <Col xs={12} sm={6}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.yieldKg')}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                required
                value={form.yieldKg}
                onChange={(e) => setForm((f) => ({ ...f, yieldKg: e.target.value }))}
              />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.priceRwfPerKg')}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                value={form.priceRwfPerKg}
                onChange={(e) => setForm((f) => ({ ...f, priceRwfPerKg: e.target.value }))}
              />
            </Form.Group>
          </Col>
        </Row>
        {yieldEntry && (
          <p className="text-muted small">
            {t('trial.grossRevenueRwf')}: {formatRWF(yieldEntry.grossRevenueRwf)}
          </p>
        )}
        <Button type="submit" size="sm" variant="success" disabled={saving}>
          {saving ? t('common.loading') : t('common.save')}
        </Button>
      </Form>
    </div>
  );
}
