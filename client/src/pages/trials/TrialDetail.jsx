import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Collapse from 'react-bootstrap/Collapse';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatNumber, seasonLabel } from '../../utils/formatters';

function emptyTreatmentForm() {
  return { code: '', label: '', description: '' };
}

/** Research Mode only — Trial workspace: config, Treatment Register, and the t x b plot grid. */
export default function TrialDetail() {
  const { t } = useTranslation();
  const { trialId } = useParams();
  const navigate = useNavigate();
  const [trial, setTrial] = useState(null);
  const [treatments, setTreatments] = useState([]);
  const [plots, setPlots] = useState([]);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAddTreatment, setShowAddTreatment] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState(emptyTreatmentForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteTrial, setShowDeleteTrial] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/trials/${trialId}`);
      setTrial(data.trial);
      setTreatments(data.treatments);
      setPlots(data.plots);
      setSeason(data.season);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, [trialId]);

  useEffect(() => {
    load();
  }, [load]);

  const addTreatment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/trials/${trialId}/treatments`, treatmentForm);
      setTreatmentForm(emptyTreatmentForm());
      setShowAddTreatment(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTreatment = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/treatments/${deleteTarget._id}`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    }
  };

  const confirmDeleteTrial = async () => {
    try {
      await api.delete(`/trials/${trialId}`);
      navigate(`/seasons/${trial.seasonId}`);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
      setShowDeleteTrial(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!trial) return <ErrorAlert error={error || { message: 'Trial not found.' }} />;

  const plotsByTreatment = new Map(treatments.map((tr) => [String(tr._id), []]));
  for (const plot of plots) {
    const list = plotsByTreatment.get(String(plot.treatmentId));
    if (list) list.push(plot);
  }
  for (const list of plotsByTreatment.values()) list.sort((a, b) => a.replicateNumber - b.replicateNumber);

  return (
    <Container fluid style={{ maxWidth: 1100 }}>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 my-3">
        <div>
          <h4 className="mb-1">
            {trial.crop} {trial.variety ? `(${trial.variety})` : ''} — {t(`trial.design_${trial.design}`, trial.design)}
          </h4>
          <div className="text-muted small">
            {seasonLabel(season)} · {t('trial.numTreatments')}: {trial.numTreatments} · {t('trial.numReplicates')}: {trial.numReplicates} ·{' '}
            {t('trial.plotSizeM2')}: {trial.plotSizeM2} m² · {t('trial.cropPopulationPerHa')}:{' '}
            {trial.computed?.cropPopulationPerHa ? formatNumber(trial.computed.cropPopulationPerHa, 0) : '—'} /ha
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} to={`/seasons/${trial.seasonId}`} variant="secondary" size="sm">
            {t('common.back')}
          </Button>
          <Button as={Link} to={`/trials/${trialId}/analysis`} variant="dark" size="sm">
            {t('trial.viewAnalysis')}
          </Button>
          <Button variant="outline-danger" size="sm" onClick={() => setShowDeleteTrial(true)}>
            {t('trial.deleteTrial')}
          </Button>
        </div>
      </div>

      <h5>{t('trial.treatmentRegister')}</h5>
      <Table size="sm" responsive className="mb-2">
        <thead>
          <tr>
            <th>{t('trial.treatmentCode')}</th>
            <th>{t('trial.treatmentLabel')}</th>
            <th>{t('trial.treatmentDescription')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {treatments.map((tr) => (
            <tr key={tr._id}>
              <td>{tr.code}</td>
              <td>{tr.label}</td>
              <td>{tr.description || '—'}</td>
              <td>
                <Button variant="link" size="sm" className="text-danger p-0" onClick={() => setDeleteTarget(tr)}>
                  {t('common.delete')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Button size="sm" variant="outline-success" onClick={() => setShowAddTreatment((s) => !s)} className="mb-3">
        + {t('common.add')} {t('trial.treatment')}
      </Button>

      <Collapse in={showAddTreatment}>
        <div className="border rounded p-3 mb-3 bg-light">
          <Form onSubmit={addTreatment}>
            <Row>
              <Col xs={12} sm={3}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('trial.treatmentCode')}</Form.Label>
                  <Form.Control
                    required
                    value={treatmentForm.code}
                    onChange={(e) => setTreatmentForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              <Col xs={12} sm={4}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('trial.treatmentLabel')}</Form.Label>
                  <Form.Control
                    required
                    value={treatmentForm.label}
                    onChange={(e) => setTreatmentForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              <Col xs={12} sm={5}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('trial.treatmentDescription')}</Form.Label>
                  <Form.Control
                    value={treatmentForm.description}
                    onChange={(e) => setTreatmentForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </Form.Group>
              </Col>
            </Row>
            <div className="d-flex gap-2">
              <Button type="submit" size="sm" variant="success" disabled={saving}>
                {saving ? t('common.loading') : t('common.create')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddTreatment(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </Form>
        </div>
      </Collapse>

      <h5 className="mt-4">{t('trial.plots')}</h5>
      <Table hover responsive bordered size="sm">
        <thead>
          <tr>
            <th>{t('trial.treatment')}</th>
            {Array.from({ length: trial.numReplicates }, (_, i) => i + 1).map((rep) => (
              <th key={rep}>
                {t('trial.replicate')} {rep}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {treatments.map((tr) => (
            <tr key={tr._id}>
              <td className="fw-bold">{tr.code}</td>
              {Array.from({ length: trial.numReplicates }, (_, i) => i + 1).map((rep) => {
                const plot = (plotsByTreatment.get(String(tr._id)) || []).find((p) => p.replicateNumber === rep);
                return (
                  <td key={rep}>
                    {plot ? (
                      <Link to={`/trial-plots/${plot._id}`} className="btn btn-sm btn-outline-success">
                        {t('common.view')}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>

      <ConfirmModal
        show={Boolean(deleteTarget)}
        title={t('trial.confirmDeleteTreatmentTitle')}
        message={t('trial.confirmDeleteTreatment', { label: deleteTarget?.label })}
        onConfirm={confirmDeleteTreatment}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        show={showDeleteTrial}
        title={t('trial.confirmDeleteTrialTitle')}
        message={t('trial.confirmDeleteTrial', { crop: trial.crop })}
        onConfirm={confirmDeleteTrial}
        onCancel={() => setShowDeleteTrial(false)}
      />
    </Container>
  );
}
