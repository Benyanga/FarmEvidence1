import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import api from '../../services/api';
import ErrorAlert from '../../components/common/ErrorAlert';

/** Every trial is a fixed Conservation Agriculture vs Conventional Farming comparison — code and label are locked, only the practice description is editable. */
function emptyTreatments() {
  return [
    { code: 'CA', label: 'Conservation Agriculture', description: '' },
    { code: 'CF', label: 'Conventional Farming', description: '' }
  ];
}

const emptyForm = {
  crop: '',
  variety: '',
  plantingDate: '',
  previousCrop: '',
  design: 'RCBD',
  numReplicates: 4,
  plotSizeM2: '',
  interRowCm: '',
  intraRowCm: '',
  seedsPerHill: '',
  marketPriceRwfPerKg: '',
  wageRatePerDayRwf: '',
  workingHoursPerDay: 8,
  significanceLevel: 0.05,
  district: '',
  site: ''
};

/** Research Mode only — creates a Trial (CA vs CF x b replicates) and its Treatment Register. */
export default function TrialSetupForm() {
  const { t } = useTranslation();
  const { seasonId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [treatments, setTreatments] = useState(emptyTreatments());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const updateTreatment = (code, field, value) => {
    setTreatments((rows) => rows.map((r) => (r.code === code ? { ...r, [field]: value } : r)));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        crop: form.crop,
        variety: form.variety || undefined,
        plantingDate: form.plantingDate || undefined,
        previousCrop: form.previousCrop || undefined,
        design: form.design,
        numTreatments: 2,
        numReplicates: Number(form.numReplicates),
        plotSizeM2: Number(form.plotSizeM2),
        rowSpacing: {
          interRowCm: form.interRowCm ? Number(form.interRowCm) : undefined,
          intraRowCm: form.intraRowCm ? Number(form.intraRowCm) : undefined
        },
        seedsPerHill: form.seedsPerHill ? Number(form.seedsPerHill) : undefined,
        marketPriceRwfPerKg: form.marketPriceRwfPerKg ? Number(form.marketPriceRwfPerKg) : undefined,
        wageRatePerDayRwf: form.wageRatePerDayRwf ? Number(form.wageRatePerDayRwf) : undefined,
        workingHoursPerDay: Number(form.workingHoursPerDay),
        significanceLevel: Number(form.significanceLevel),
        district: form.district || undefined,
        site: form.site || undefined,
        treatments: treatments.map(({ code, label, description }) => ({ code, label, description: description || undefined }))
      };
      const { data } = await api.post(`/seasons/${seasonId}/trials`, body);
      navigate(`/trials/${data.trial._id}`);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container style={{ maxWidth: 900 }}>
      <div className="d-flex justify-content-between align-items-center my-3">
        <h4 className="mb-0">{t('trial.newTrial')}</h4>
        <Button as={Link} to={`/seasons/${seasonId}`} variant="secondary" size="sm">
          {t('common.back')}
        </Button>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      <Form onSubmit={submit}>
        <Row>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.crop')}</Form.Label>
              <Form.Control required value={form.crop} onChange={(e) => set('crop', e.target.value)} />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.variety')}</Form.Label>
              <Form.Control value={form.variety} onChange={(e) => set('variety', e.target.value)} />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.plantingDate')}</Form.Label>
              <Form.Control type="date" value={form.plantingDate} onChange={(e) => set('plantingDate', e.target.value)} />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.previousCrop')}</Form.Label>
              <Form.Control value={form.previousCrop} onChange={(e) => set('previousCrop', e.target.value)} />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.design')}</Form.Label>
              <Form.Select value={form.design} onChange={(e) => set('design', e.target.value)}>
                <option value="RCBD">RCBD</option>
                <option value="CRD">CRD</option>
                <option value="split-plot">Split-plot</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.numReplicates')}</Form.Label>
              <Form.Control
                type="number"
                min={2}
                max={10}
                required
                value={form.numReplicates}
                onChange={(e) => set('numReplicates', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.plotSizeM2')}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step="0.01"
                required
                value={form.plotSizeM2}
                onChange={(e) => set('plotSizeM2', e.target.value)}
              />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.interRowCm')}</Form.Label>
              <Form.Control type="number" min={0} value={form.interRowCm} onChange={(e) => set('interRowCm', e.target.value)} />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.intraRowCm')}</Form.Label>
              <Form.Control type="number" min={0} value={form.intraRowCm} onChange={(e) => set('intraRowCm', e.target.value)} />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.seedsPerHill')}</Form.Label>
              <Form.Control type="number" min={0} value={form.seedsPerHill} onChange={(e) => set('seedsPerHill', e.target.value)} />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.significanceLevel')}</Form.Label>
              <Form.Control
                type="number"
                min={0.01}
                max={0.99}
                step="0.01"
                value={form.significanceLevel}
                onChange={(e) => set('significanceLevel', e.target.value)}
              />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.marketPriceRwfPerKg')}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                value={form.marketPriceRwfPerKg}
                onChange={(e) => set('marketPriceRwfPerKg', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.wageRatePerDayRwf')}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                value={form.wageRatePerDayRwf}
                onChange={(e) => set('wageRatePerDayRwf', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.workingHoursPerDay')}</Form.Label>
              <Form.Control
                type="number"
                min={1}
                value={form.workingHoursPerDay}
                onChange={(e) => set('workingHoursPerDay', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>{t('trial.district')}</Form.Label>
              <Form.Control value={form.district} onChange={(e) => set('district', e.target.value)} />
            </Form.Group>
          </Col>
        </Row>

        <h5 className="mt-3">{t('trial.treatmentRegister')}</h5>
        <p className="text-muted small">{t('trial.treatmentRegisterHint')}</p>

        <Table size="sm" responsive>
          <thead>
            <tr>
              <th>{t('trial.treatmentCode')}</th>
              <th>{t('trial.treatmentLabel')}</th>
              <th>{t('trial.treatmentDescription')}</th>
            </tr>
          </thead>
          <tbody>
            {treatments.map((row) => (
              <tr key={row.code}>
                <td style={{ maxWidth: 100 }} className="align-middle fw-semibold">
                  {row.code}
                </td>
                <td className="align-middle">{row.label}</td>
                <td>
                  <Form.Control
                    size="sm"
                    placeholder={t('trial.treatmentDescription')}
                    value={row.description}
                    onChange={(e) => updateTreatment(row.code, 'description', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div>
          <Button type="submit" variant="success" disabled={saving}>
            {saving ? t('common.loading') : t('common.create')}
          </Button>
        </div>
      </Form>
    </Container>
  );
}
