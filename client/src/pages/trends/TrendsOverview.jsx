import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import TrendChart from '../../components/charts/TrendChart';
import TrendClassification from './TrendClassification';
import ExplainPanel from '../../components/explainability/ExplainPanel';

export default function TrendsOverview() {
  const { t } = useTranslation();
  const { setupId } = useParams();
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/compute/trends/${setupId}`);
      setIndicators(data.indicators.filter((i) => i.timeSeries.length > 0));
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, [setupId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingSpinner />;

  return (
    <Container>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3">
        <h4 className="mb-0">{t('nav.trends')}</h4>
        <Button as={Link} to={`/setups/${setupId}`} variant="secondary" size="sm">
          {t('common.back')}
        </Button>
      </div>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      {indicators.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <Row className="g-3">
          {indicators.map((ind) => (
            <Col xs={12} md={6} key={ind.indicator}>
              <Card>
                <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-1">
                  <span>{ind.indicator}</span>
                  <TrendClassification classification={ind.classification} />
                </Card.Header>
                <Card.Body>
                  <TrendChart timeSeries={ind.timeSeries} label={ind.indicator} />
                  <ExplainPanel explanation={ind.explanation} simplified />
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}
