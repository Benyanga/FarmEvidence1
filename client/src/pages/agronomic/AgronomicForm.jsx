import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import { writeThrough } from '../../services/offline.service';
import ErrorAlert from '../../components/common/ErrorAlert';
import { AGRONOMIC_INDICATORS } from '../../utils/constants';

function toFormState(agronomic) {
  const state = {
    observationDate: agronomic?.observationDate ? agronomic.observationDate.slice(0, 10) : '',
    growthStage: agronomic?.growthStage || ''
  };
  for (const { key } of AGRONOMIC_INDICATORS) {
    state[key] = agronomic?.[key]?.value ?? '';
  }
  return state;
}

export default function AgronomicForm({ plotId, agronomic, onChanged }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(toFormState(agronomic));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { observationDate: form.observationDate || undefined, growthStage: form.growthStage };
      for (const { key } of AGRONOMIC_INDICATORS) {
        if (form[key] !== '') body[key] = { value: Number(form[key]) };
      }
      await writeThrough({ endpoint: `/plots/${plotId}/agronomic`, method: 'POST', body });
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form onSubmit={submit}>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <Row>
        {AGRONOMIC_INDICATORS.map(({ key, unit }) => (
          <Col xs={12} sm={6} md={4} key={key}>
            <Form.Group className="mb-2">
              <Form.Label>
                {t(`agronomic.${key}`)} <span className="text-muted small">({unit})</span>
              </Form.Label>
              <Form.Control type="number" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            </Form.Group>
          </Col>
        ))}
      </Row>
      <Row>
        <Col xs={12} sm={6} md={4}>
          <Form.Group className="mb-2">
            <Form.Label>{t('agronomic.observationDate')}</Form.Label>
            <Form.Control type="date" value={form.observationDate} onChange={(e) => setForm((f) => ({ ...f, observationDate: e.target.value }))} />
          </Form.Group>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Form.Group className="mb-2">
            <Form.Label>{t('agronomic.growthStage')}</Form.Label>
            <Form.Control value={form.growthStage} onChange={(e) => setForm((f) => ({ ...f, growthStage: e.target.value }))} />
          </Form.Group>
        </Col>
      </Row>
      <Button type="submit" size="sm" variant="success" disabled={saving}>
        {saving ? t('common.loading') : t('common.save')}
      </Button>
    </Form>
  );
}
