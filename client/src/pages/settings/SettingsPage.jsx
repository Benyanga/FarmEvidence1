import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import i18n from '../../i18n';

const emptySetupForm = {
  name: '',
  district: '',
  sector: '',
  cell: '',
  village: '',
  soilType: '',
  rainfallPattern: '',
  adoptionStartSeason: 1
};

/** Research Mode only — Account (language) + Setup-level settings. */
export default function SettingsPage() {
  const { t } = useTranslation();
  const [setups, setSetups] = useState([]);
  const [setupId, setSetupId] = useState('');
  const [setupForm, setSetupForm] = useState(emptySetupForm);
  const [loading, setLoading] = useState(true);
  const [savingSetup, setSavingSetup] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/setups')
      .then(({ data }) => {
        setSetups(data.setups);
        if (data.setups.length > 0) setSetupId(data.setups[0]._id);
      })
      .catch((err) => setError(err.response?.data?.error || { message: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const setup = setups.find((s) => s._id === setupId);
    if (!setup) return;
    setSetupForm({
      name: setup.name || '',
      district: setup.location?.district || '',
      sector: setup.location?.sector || '',
      cell: setup.location?.cell || '',
      village: setup.location?.village || '',
      soilType: setup.soilType || '',
      rainfallPattern: setup.rainfallPattern || '',
      adoptionStartSeason: setup.adoptionStartSeason || 1
    });
  }, [setupId, setups]);

  const toggleLanguage = async () => {
    const next = i18n.language === 'en' ? 'rw' : 'en';
    i18n.changeLanguage(next);
    try {
      await api.put('/users/me', { preferredLanguage: next });
      setSavedNotice(true);
    } catch {
      // best-effort; language still switches locally
    }
  };

  const saveSetup = async (e) => {
    e.preventDefault();
    setSavingSetup(true);
    setError(null);
    try {
      await api.put(`/setups/${setupId}`, {
        name: setupForm.name,
        location: { district: setupForm.district, sector: setupForm.sector, cell: setupForm.cell, village: setupForm.village },
        soilType: setupForm.soilType,
        rainfallPattern: setupForm.rainfallPattern,
        adoptionStartSeason: Number(setupForm.adoptionStartSeason)
      });
      setSavedNotice(true);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setSavingSetup(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Container style={{ maxWidth: 700 }}>
      <h4 className="my-3">{t('nav.settings')}</h4>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      {savedNotice && (
        <Alert variant="success" dismissible onClose={() => setSavedNotice(false)}>
          {t('settings.saved')}
        </Alert>
      )}

      <h5>{t('settings.account')}</h5>
      <p className="text-muted small">{t('settings.profileHint')}</p>
      <div className="d-flex align-items-center gap-2 mb-4">
        <span>{t('common.language')}:</span>
        <Button size="sm" variant="outline-secondary" onClick={toggleLanguage}>
          {i18n.language === 'en' ? 'English' : 'Kinyarwanda'}
        </Button>
      </div>

      <h5>{t('settings.setupSettings')}</h5>
      {setups.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <Form onSubmit={saveSetup}>
          <Form.Group className="mb-3">
            <Form.Label>{t('settings.selectSetup')}</Form.Label>
            <Form.Select value={setupId} onChange={(e) => setSetupId(e.target.value)}>
              {setups.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Row>
            <Col xs={12} sm={6}>
              <Form.Group className="mb-2">
                <Form.Label>{t('setup.name')}</Form.Label>
                <Form.Control value={setupForm.name} onChange={(e) => setSetupForm((f) => ({ ...f, name: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Group className="mb-2">
                <Form.Label>{t('setup.district')}</Form.Label>
                <Form.Control value={setupForm.district} onChange={(e) => setSetupForm((f) => ({ ...f, district: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Group className="mb-2">
                <Form.Label>{t('setup.sector')}</Form.Label>
                <Form.Control value={setupForm.sector} onChange={(e) => setSetupForm((f) => ({ ...f, sector: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Group className="mb-2">
                <Form.Label>{t('setup.cell')}</Form.Label>
                <Form.Control value={setupForm.cell} onChange={(e) => setSetupForm((f) => ({ ...f, cell: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Group className="mb-2">
                <Form.Label>{t('setup.village')}</Form.Label>
                <Form.Control value={setupForm.village} onChange={(e) => setSetupForm((f) => ({ ...f, village: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Group className="mb-2">
                <Form.Label>{t('setup.soilType')}</Form.Label>
                <Form.Control value={setupForm.soilType} onChange={(e) => setSetupForm((f) => ({ ...f, soilType: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Group className="mb-2">
                <Form.Label>{t('setup.rainfallPattern')}</Form.Label>
                <Form.Control
                  value={setupForm.rainfallPattern}
                  onChange={(e) => setSetupForm((f) => ({ ...f, rainfallPattern: e.target.value }))}
                />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Group className="mb-2">
                <Form.Label>{t('setup.adoptionStartSeason')}</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={setupForm.adoptionStartSeason}
                  onChange={(e) => setSetupForm((f) => ({ ...f, adoptionStartSeason: e.target.value }))}
                />
              </Form.Group>
            </Col>
          </Row>

          <Button type="submit" variant="success" disabled={savingSetup}>
            {savingSetup ? t('common.loading') : t('common.save')}
          </Button>
        </Form>
      )}
    </Container>
  );
}
