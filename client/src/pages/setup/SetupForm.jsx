import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import { writeThrough } from '../../services/offline.service';
import ErrorAlert from '../../components/common/ErrorAlert';
import useRole from '../../hooks/useRole';

const initial = {
  name: '',
  location: { district: '', sector: '', cell: '', village: '' },
  farmDimensions: { length: '', width: '' },
  adoptionStartSeason: 1,
  soilType: '',
  rainfallPattern: '',
  description: '',
  rcbd: { numReplications: 2 }
};

export default function SetupForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role } = useRole();
  const isResearch = role === 'researcher';
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const area = useMemo(() => {
    const l = Number(values.farmDimensions.length);
    const w = Number(values.farmDimensions.width);
    return l > 0 && w > 0 ? Math.round(l * w * 100) / 100 : null;
  }, [values.farmDimensions]);

  const set = (path, value) => {
    setValues((prev) => {
      const next = { ...prev };
      const keys = path.split('.');
      let cursor = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cursor[keys[i]] = { ...cursor[keys[i]] };
        cursor = cursor[keys[i]];
      }
      cursor[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...values,
        farmDimensions: {
          length: values.farmDimensions.length ? Number(values.farmDimensions.length) : undefined,
          width: values.farmDimensions.width ? Number(values.farmDimensions.width) : undefined
        }
      };
      if (!isResearch) delete body.rcbd;
      const result = await writeThrough({ store: 'setups', endpoint: '/setups', method: 'POST', body });
      const setup = result.data.setup || result.data;
      navigate(`/setups/${setup._id}`);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
      setSaving(false);
    }
  };

  return (
    <Container style={{ maxWidth: 720 }}>
      <div className="d-flex justify-content-between align-items-center my-3">
        <h4 className="mb-0">{t('dashboard.createSetup')}</h4>
        <Button as={Link} to="/setups" variant="secondary" size="sm">
          {t('common.back')}
        </Button>
      </div>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <Form onSubmit={submit}>
        <Form.Group className="mb-3">
          <Form.Label>{t('setup.setupType')}</Form.Label>
          <div>
            <Badge bg={isResearch ? 'primary' : 'success'}>{t(isResearch ? 'setup.research_trial' : 'setup.farm')}</Badge>
          </div>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>{t('setup.name')}</Form.Label>
          <Form.Control required value={values.name} onChange={(e) => set('name', e.target.value)} />
        </Form.Group>

        <Row>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-3">
              <Form.Label>{t('setup.district')}</Form.Label>
              <Form.Control value={values.location.district} onChange={(e) => set('location.district', e.target.value)} />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-3">
              <Form.Label>{t('setup.sector')}</Form.Label>
              <Form.Control value={values.location.sector} onChange={(e) => set('location.sector', e.target.value)} />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-3">
              <Form.Label>{t('setup.cell')}</Form.Label>
              <Form.Control value={values.location.cell} onChange={(e) => set('location.cell', e.target.value)} />
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Group className="mb-3">
              <Form.Label>{t('setup.village')}</Form.Label>
              <Form.Control value={values.location.village} onChange={(e) => set('location.village', e.target.value)} />
            </Form.Group>
          </Col>
        </Row>

        <Form.Label>{t('setup.farmDimensions')}</Form.Label>
        <Row>
          <Col xs={12} sm={4}>
            <Form.Group className="mb-3">
              <Form.Label className="small text-muted">{t('setup.length')} (m)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={values.farmDimensions.length}
                onChange={(e) => set('farmDimensions.length', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={12} sm={4}>
            <Form.Group className="mb-3">
              <Form.Label className="small text-muted">{t('setup.width')} (m)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={values.farmDimensions.width}
                onChange={(e) => set('farmDimensions.width', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={12} sm={4}>
            <Form.Group className="mb-3">
              <Form.Label className="small text-muted">{t('setup.area')} (m²)</Form.Label>
              <Form.Control readOnly plaintext className="bg-light px-2" value={area ?? '—'} />
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mb-3">
          <Form.Label>{t('setup.soilType')}</Form.Label>
          <Form.Control value={values.soilType} onChange={(e) => set('soilType', e.target.value)} />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>{t('setup.adoptionStartSeason')}</Form.Label>
          <Form.Control
            type="number"
            min={1}
            required
            value={values.adoptionStartSeason}
            onChange={(e) => set('adoptionStartSeason', Number(e.target.value))}
          />
        </Form.Group>

        {isResearch && (
          <Form.Group className="mb-3">
            <Form.Label>{t('setup.numReplications')}</Form.Label>
            <Form.Control
              type="number"
              min={2}
              max={5}
              value={values.rcbd.numReplications}
              onChange={(e) => set('rcbd.numReplications', Number(e.target.value))}
            />
          </Form.Group>
        )}

        <Form.Group className="mb-3">
          <Form.Label>{t('setup.description')}</Form.Label>
          <Form.Control as="textarea" rows={2} value={values.description} onChange={(e) => set('description', e.target.value)} />
        </Form.Group>

        <Button type="submit" variant="success" disabled={saving}>
          {saving ? t('common.loading') : t('common.create')}
        </Button>
      </Form>
    </Container>
  );
}
