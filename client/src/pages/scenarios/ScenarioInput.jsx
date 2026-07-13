import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import ScenarioResults from './ScenarioResults';
import { seasonLabel } from '../../utils/formatters';

export default function ScenarioInput() {
  const { t } = useTranslation();
  const { setupId } = useParams();
  const [plotOptions, setPlotOptions] = useState([]);
  const [plotId, setPlotId] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/setups/${setupId}`);
      const seasons = data.seasons;
      const plotLists = await Promise.all(seasons.map((s) => api.get(`/seasons/${s._id}/plots`)));
      const options = [];
      seasons.forEach((season, i) => {
        plotLists[i].data.plots.forEach((plot) => {
          options.push({ plot, season });
        });
      });
      setPlotOptions(options);
      if (options.length > 0) setPlotId(options[0].plot._id);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, [setupId]);

  useEffect(() => {
    load();
  }, [load]);

  const runScenarios = async () => {
    if (!plotId) return;
    setRunning(true);
    setError(null);
    try {
      const { data } = await api.post(`/compute/scenarios/${plotId}`, {});
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Container style={{ maxWidth: 900 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3">
        <h4 className="mb-0">{t('nav.scenarios')}</h4>
        <Button as={Link} to={`/setups/${setupId}`} variant="secondary" size="sm">
          {t('common.back')}
        </Button>
      </div>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      {plotOptions.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <>
          <Row className="align-items-end mb-3 g-2">
            <Col xs={12} sm={8}>
              <Form.Group>
                <Form.Label>{t('common.season')} / {t('plot.replicationNumber')}</Form.Label>
                <Form.Select value={plotId} onChange={(e) => setPlotId(e.target.value)}>
                  {plotOptions.map(({ plot, season }) => (
                    <option key={plot._id} value={plot._id}>
                      {seasonLabel(season)} ({season.farmingSystem}) — #{plot.replicationNumber}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} sm={4}>
              <Button variant="success" onClick={runScenarios} disabled={running}>
                {running ? t('common.loading') : t('common.compute')}
              </Button>
            </Col>
          </Row>

          <ScenarioResults data={result} />
        </>
      )}
    </Container>
  );
}
