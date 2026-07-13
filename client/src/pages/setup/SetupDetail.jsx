import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import ConfirmModal from '../../components/common/ConfirmModal';
import useMode from '../../hooks/useMode';

const YEAR_RANGE = Array.from({ length: 2050 - 2026 + 1 }, (_, i) => 2026 + i);

const emptyProfileForm = {
  name: '',
  district: '',
  sector: '',
  cell: '',
  village: '',
  soilType: '',
  rainfallPattern: ''
};

export default function SetupDetail() {
  const { t } = useTranslation();
  const { setupId } = useParams();
  const navigate = useNavigate();
  const [setup, setSetup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [showDeleteFarm, setShowDeleteFarm] = useState(false);

  const mode = useMode(setup);
  const isResearch = mode === 'research';

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/setups/${setupId}`);
      setSetup(data.setup);
      setProfileForm({
        name: data.setup.name || '',
        district: data.setup.location?.district || '',
        sector: data.setup.location?.sector || '',
        cell: data.setup.location?.cell || '',
        village: data.setup.location?.village || '',
        soilType: data.setup.soilType || '',
        rainfallPattern: data.setup.rainfallPattern || ''
      });
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, [setupId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.put(`/setups/${setupId}`, {
        name: profileForm.name,
        location: {
          district: profileForm.district,
          sector: profileForm.sector,
          cell: profileForm.cell,
          village: profileForm.village
        },
        soilType: profileForm.soilType,
        rainfallPattern: profileForm.rainfallPattern
      });
      setSavedNotice(true);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteFarm = async () => {
    try {
      await api.delete(`/setups/${setupId}`);
      setShowDeleteFarm(false);
      navigate('/farms');
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
      setShowDeleteFarm(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!setup) return <ErrorAlert error={error || { message: 'Setup not found.' }} />;

  return (
    <Container fluid style={isResearch ? undefined : { maxWidth: 700 }}>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 my-3">
        <div>
          <h4 className="mb-1">
            {setup.name} <Badge bg={mode === 'research' ? 'primary' : 'success'}>{t(`setup.${setup.setupType}`)}</Badge>
          </h4>
          <div className="text-muted small">
            {[setup.location?.district, setup.location?.sector, setup.location?.cell, setup.location?.village].filter(Boolean).join(', ')}
            {setup.area ? ` · ${setup.area} m²` : ''} {setup.soilType ? ` · ${setup.soilType}` : ''}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} to={isResearch ? '/setups' : '/farms'} variant="secondary" size="sm">
            {t('common.back')}
          </Button>
          {!isResearch && (
            <Button variant="outline-danger" size="sm" onClick={() => setShowDeleteFarm(true)}>
              {t('setup.deleteFarm')}
            </Button>
          )}
        </div>
      </div>

      {isResearch ? (
        <>
          <h5>{t('setup.years')}</h5>
          <p className="text-muted small">{t('setup.selectYear')}</p>
          <Row className="g-2">
            {YEAR_RANGE.map((year) => (
              <Col xs={6} sm={4} md={3} lg={2} key={year}>
                <Button as={Link} to={`/setups/${setupId}/years/${year}`} variant="outline-dark" className="w-100">
                  {year}
                </Button>
              </Col>
            ))}
          </Row>
        </>
      ) : (
        <>
          {savedNotice && (
            <Alert variant="success" dismissible onClose={() => setSavedNotice(false)}>
              {t('settings.saved')}
            </Alert>
          )}
          <Form onSubmit={saveProfile}>
            <Row>
              <Col xs={12} sm={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('setup.name')}</Form.Label>
                  <Form.Control value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} />
                </Form.Group>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('setup.district')}</Form.Label>
                  <Form.Control
                    value={profileForm.district}
                    onChange={(e) => setProfileForm((f) => ({ ...f, district: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('setup.sector')}</Form.Label>
                  <Form.Control value={profileForm.sector} onChange={(e) => setProfileForm((f) => ({ ...f, sector: e.target.value }))} />
                </Form.Group>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('setup.cell')}</Form.Label>
                  <Form.Control value={profileForm.cell} onChange={(e) => setProfileForm((f) => ({ ...f, cell: e.target.value }))} />
                </Form.Group>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('setup.village')}</Form.Label>
                  <Form.Control value={profileForm.village} onChange={(e) => setProfileForm((f) => ({ ...f, village: e.target.value }))} />
                </Form.Group>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('setup.soilType')}</Form.Label>
                  <Form.Control
                    value={profileForm.soilType}
                    onChange={(e) => setProfileForm((f) => ({ ...f, soilType: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('setup.rainfallPattern')}</Form.Label>
                  <Form.Control
                    value={profileForm.rainfallPattern}
                    onChange={(e) => setProfileForm((f) => ({ ...f, rainfallPattern: e.target.value }))}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Button type="submit" variant="success" size="sm" disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </Form>
        </>
      )}

      <ConfirmModal
        show={showDeleteFarm}
        title={t('setup.confirmDeleteFarmTitle')}
        message={t('setup.confirmDeleteFarm', { name: setup.name })}
        onConfirm={confirmDeleteFarm}
        onCancel={() => setShowDeleteFarm(false)}
      />
    </Container>
  );
}
