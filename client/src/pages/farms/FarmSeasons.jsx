import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Badge from 'react-bootstrap/Badge';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Collapse from 'react-bootstrap/Collapse';
import api from '../../services/api';
import { writeThrough } from '../../services/offline.service';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import { FARMING_SYSTEMS } from '../../utils/constants';
import { seasonLabel } from '../../utils/formatters';

const emptySeasonForm = {
  seasonNumber: 1,
  seasonLabel: '',
  year: new Date().getFullYear(),
  seasonCode: 'A',
  farmingSystem: 'CA',
  cropType: '',
  rowSpacing: { intraRow: '', interRow: '' },
  seedsPerHill: ''
};

function computeCropPopulationPreview({ intraRow, interRow, seedsPerHill }) {
  const intra = Number(intraRow);
  const inter = Number(interRow);
  const seeds = Number(seedsPerHill);
  if (!(intra > 0 && inter > 0 && seeds > 0)) return null;
  return Math.round((10000 / ((intra / 100) * (inter / 100))) * seeds);
}

const MODE_CONFIG = {
  'data-entry': { backTo: '/data-entry', actionTo: (id) => `/seasons/${id}/data-entry`, canCreate: true },
  cba: { backTo: '/cba-results', actionTo: (id) => `/seasons/${id}/cba`, canCreate: false },
  reports: { backTo: '/seasonal-reports', actionTo: (id) => `/seasons/${id}/seasonal-report`, canCreate: false }
};

/** Farmer Mode only — a farm's seasons, reused by Data Entry / CBA Results / Seasonal Reports. */
export default function FarmSeasons({ mode }) {
  const { t } = useTranslation();
  const { setupId } = useParams();
  const [setup, setSetup] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptySeasonForm);

  const config = MODE_CONFIG[mode];

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/setups/${setupId}`);
      setSetup(data.setup);
      setSeasons(data.seasons);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, [setupId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setForm((f) => ({ ...f, seasonNumber: seasons.length + 1 }));
  }, [seasons.length]);

  const submitSeason = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        rowSpacing: {
          intraRow: form.rowSpacing.intraRow ? Number(form.rowSpacing.intraRow) : undefined,
          interRow: form.rowSpacing.interRow ? Number(form.rowSpacing.interRow) : undefined
        },
        seedsPerHill: form.seedsPerHill ? Number(form.seedsPerHill) : undefined
      };
      await writeThrough({ store: 'seasons', endpoint: `/setups/${setupId}/seasons`, method: 'POST', body });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!setup) return <ErrorAlert error={error || { message: 'Setup not found.' }} />;

  const cropPopulation = computeCropPopulationPreview({ ...form.rowSpacing, seedsPerHill: form.seedsPerHill });

  return (
    <Container fluid>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 my-3">
        <div>
          <h4 className="mb-1">{setup.name}</h4>
          <div className="text-muted small">
            {[setup.location?.district, setup.location?.sector, setup.location?.cell, setup.location?.village].filter(Boolean).join(', ')}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} to={config.backTo} variant="secondary" size="sm">
            {t('common.back')}
          </Button>
          {config.canCreate && (
            <Button size="sm" variant="success" onClick={() => setShowForm((s) => !s)}>
              + {t('common.add')} {t('common.season')}
            </Button>
          )}
        </div>
      </div>

      {config.canCreate && (
        <Collapse in={showForm}>
          <div className="border rounded p-3 mb-3 bg-light">
            <Form onSubmit={submitSeason}>
              <Row>
                <Col xs={12} sm={6} md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>{t('season.seasonNumber')}</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={form.seasonNumber}
                      onChange={(e) => setForm((f) => ({ ...f, seasonNumber: Number(e.target.value) }))}
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>{t('season.year')}</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.year}
                      onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>{t('season.seasonCode')}</Form.Label>
                    <Form.Select value={form.seasonCode} onChange={(e) => setForm((f) => ({ ...f, seasonCode: e.target.value }))}>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>{t('season.seasonLabel')}</Form.Label>
                    <Form.Control
                      placeholder={`Season ${form.seasonCode} ${form.year}`}
                      value={form.seasonLabel}
                      onChange={(e) => setForm((f) => ({ ...f, seasonLabel: e.target.value }))}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col xs={12} sm={6} md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>{t('season.farmingSystem')}</Form.Label>
                    <Form.Select value={form.farmingSystem} onChange={(e) => setForm((f) => ({ ...f, farmingSystem: e.target.value }))}>
                      {FARMING_SYSTEMS.map((sys) => (
                        <option key={sys} value={sys}>
                          {sys}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>{t('season.cropType')}</Form.Label>
                    <Form.Control required value={form.cropType} onChange={(e) => setForm((f) => ({ ...f, cropType: e.target.value }))} />
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>{t('season.intraRow')} (cm)</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.rowSpacing.intraRow}
                      onChange={(e) => setForm((f) => ({ ...f, rowSpacing: { ...f.rowSpacing, intraRow: e.target.value } }))}
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>{t('season.interRow')} (cm)</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.rowSpacing.interRow}
                      onChange={(e) => setForm((f) => ({ ...f, rowSpacing: { ...f.rowSpacing, interRow: e.target.value } }))}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col xs={12} sm={6} md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>{t('season.seedsPerHill')}</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.seedsPerHill}
                      onChange={(e) => setForm((f) => ({ ...f, seedsPerHill: e.target.value }))}
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Group className="mb-2">
                    <Form.Label>{t('season.cropPopulation')} (plants/ha)</Form.Label>
                    <Form.Control readOnly plaintext className="bg-light px-2" value={cropPopulation ?? '—'} />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex gap-2 mt-2">
                <Button type="submit" variant="success" size="sm" disabled={saving}>
                  {saving ? t('common.loading') : t('common.create')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </Form>
          </div>
        </Collapse>
      )}

      <h5 className="mt-3">{t('nav.seasons')}</h5>
      {seasons.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <Table hover responsive>
          <thead>
            <tr>
              <th>{t('season.seasonNumber')}</th>
              <th>{t('season.seasonLabel')}</th>
              <th>{t('season.farmingSystem')}</th>
              <th>{t('season.cropType')}</th>
              <th>{t('season.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((season) => (
              <tr key={season._id}>
                <td>{season.seasonNumber}</td>
                <td>{seasonLabel(season)}</td>
                <td>
                  <Badge bg={season.farmingSystem === 'CA' ? 'success' : 'secondary'}>{season.farmingSystem}</Badge>
                </td>
                <td>{season.cropType}</td>
                <td>
                  <Badge bg="secondary">{season.status}</Badge>
                </td>
                <td>
                  <Link to={config.actionTo(season._id)} className="btn btn-sm btn-outline-success">
                    {mode === 'data-entry' ? t('common.recordData') : t('common.view')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Container>
  );
}
