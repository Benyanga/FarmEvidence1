import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import LaborEntry from '../costs/LaborEntry';
import CostEntry from '../costs/CostEntry';
import YieldEntry from '../costs/YieldEntry';
import AgronomicForm from '../agronomic/AgronomicForm';
import AgronomicChart from '../agronomic/AgronomicChart';
import useCompute from '../../hooks/useCompute';
import { seasonLabel } from '../../utils/formatters';

/**
 * Farmer Mode Data Entry — the four tables (Labour Costs, Input Costs,
 * Agronomic Records, Yield & Revenue) for a season's single implicit plot,
 * plus the Run Computation action. See Request 3/5.
 */
export default function FarmerDataEntry() {
  const { t } = useTranslation();
  const { seasonId } = useParams();
  const navigate = useNavigate();

  const [season, setSeason] = useState(null);
  const [plot, setPlot] = useState(null);
  const [costs, setCosts] = useState([]);
  const [labor, setLabor] = useState([]);
  const [yields, setYields] = useState([]);
  const [agronomic, setAgronomic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { run: runCompute, loading: computing, error: computeError } = useCompute(`/compute/season/${seasonId}`);

  const load = useCallback(async () => {
    try {
      const { data: seasonData } = await api.get(`/seasons/${seasonId}`);
      setSeason(seasonData.season);
      const activePlot = seasonData.plots[0];
      if (activePlot) {
        const { data: plotData } = await api.get(`/plots/${activePlot._id}`);
        setPlot(plotData.plot);
        setCosts(plotData.costs);
        setLabor(plotData.labor);
        setYields(plotData.yields || []);
        setAgronomic(plotData.agronomic);
      }
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCompute = async () => {
    try {
      await runCompute();
      navigate(`/seasons/${seasonId}/cba`);
    } catch {
      // error surfaced via computeError
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!season) return <ErrorAlert error={error || { message: 'Season not found.' }} />;

  return (
    <Container fluid>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <ErrorAlert error={computeError} />

      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 my-3">
        <div>
          <h4 className="mb-1">
            {seasonLabel(season)} <Badge bg={season.farmingSystem === 'CA' ? 'success' : 'secondary'}>{season.farmingSystem}</Badge>
          </h4>
          <div className="text-muted small">{season.cropType}</div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} to={`/farms/${season.setupId}/data-entry`} variant="secondary" size="sm">
            {t('common.back')}
          </Button>
          <Button size="sm" variant="dark" onClick={handleCompute} disabled={computing || !plot}>
            {computing ? t('common.loading') : t('cba.runCompute')}
          </Button>
        </div>
      </div>

      {!plot ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <>
          <Card className="mb-3">
            <Card.Header>{t('nav.laborCosts')}</Card.Header>
            <Card.Body>
              <LaborEntry plotId={plot._id} seasonId={seasonId} season={season} labor={labor} onChanged={load} />
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Header>{t('nav.inputCosts')}</Card.Header>
            <Card.Body>
              <CostEntry plotId={plot._id} costs={costs} onChanged={load} />
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Header>{t('nav.agronomic')}</Card.Header>
            <Card.Body>
              <Row>
                <Col xs={12} md={7}>
                  <AgronomicForm plotId={plot._id} agronomic={agronomic} onChanged={load} />
                </Col>
                <Col xs={12} md={5}>
                  <AgronomicChart agronomic={agronomic} />
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Header>{t('nav.yieldRevenue')}</Card.Header>
            <Card.Body>
              <YieldEntry plotId={plot._id} yields={yields} onChanged={load} />
            </Card.Body>
          </Card>

          <div className="d-flex justify-content-end mb-4">
            <Button variant="dark" onClick={handleCompute} disabled={computing}>
              {computing ? t('common.loading') : t('cba.runCompute')}
            </Button>
          </div>
        </>
      )}
    </Container>
  );
}
