import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Badge from 'react-bootstrap/Badge';
import api from '../../services/api';
import { writeThrough } from '../../services/offline.service';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import CostEntry from '../costs/CostEntry';
import LaborEntry from '../costs/LaborEntry';
import YieldEntry from '../costs/YieldEntry';
import CostSummary from '../costs/CostSummary';
import AgronomicForm from '../agronomic/AgronomicForm';
import AgronomicChart from '../agronomic/AgronomicChart';
import { formatRWF } from '../../utils/formatters';
import { isResearchSetup } from '../../utils/constants';

export default function PlotDetail() {
  const { t } = useTranslation();
  const { plotId } = useParams();
  const [plot, setPlot] = useState(null);
  const [season, setSeason] = useState(null);
  const [costs, setCosts] = useState([]);
  const [labor, setLabor] = useState([]);
  const [yields, setYields] = useState([]);
  const [agronomic, setAgronomic] = useState(null);
  const [setupType, setSetupType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editForm, setEditForm] = useState({ plotArea: '', yieldValue: '', priceValue: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/plots/${plotId}`);
      setPlot(data.plot);
      setSeason(data.season);
      setCosts(data.costs);
      setLabor(data.labor);
      setYields(data.yields || []);
      setAgronomic(data.agronomic);
      setEditForm({
        plotArea: data.plot.plotArea ?? '',
        yieldValue: data.plot.yield?.value ?? '',
        priceValue: data.plot.sellingPrice?.value ?? ''
      });
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, [plotId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!plot?.setupId) return;
    api.get(`/setups/${plot.setupId}`).then(({ data }) => setSetupType(data.setup.setupType)).catch(() => {});
  }, [plot?.setupId]);

  const isFarmer = setupType ? !isResearchSetup(setupType) : true;

  const saveOverview = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        plotArea: Number(editForm.plotArea),
        yield: { value: editForm.yieldValue ? Number(editForm.yieldValue) : undefined, isObserved: true },
        sellingPrice: { value: editForm.priceValue ? Number(editForm.priceValue) : undefined }
      };
      await writeThrough({ store: 'plots', endpoint: `/plots/${plotId}`, method: 'PUT', body });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!plot) return <ErrorAlert error={error || { message: 'Plot not found.' }} />;

  return (
    <Container>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3">
        <h4 className="mb-0">
          {t('plot.replicationNumber')} {plot.replicationNumber}{' '}
          {typeof plot.computed?.profit === 'number' && (
            <Badge bg={plot.computed.profit >= 0 ? 'success' : 'danger'}>{t('cba.profit')}: {formatRWF(plot.computed.profit)}</Badge>
          )}
        </h4>
        <Button as={Link} to={`/seasons/${plot.seasonId}`} variant="secondary" size="sm">
          {t('common.back')}
        </Button>
      </div>

      <Tabs defaultActiveKey="overview" className="mb-3">
        <Tab eventKey="overview" title={t('common.view')}>
          <Form onSubmit={saveOverview} className="mb-3" style={{ maxWidth: 480 }}>
            <Row>
              <Col xs={12} sm={4}>
                <Form.Group className="mb-2">
                  <Form.Label>{t('plot.plotArea')}</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={editForm.plotArea}
                    onChange={(e) => setEditForm((f) => ({ ...f, plotArea: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              {!isFarmer && (
                <>
                  <Col xs={12} sm={4}>
                    <Form.Group className="mb-2">
                      <Form.Label>{t('plot.yield')}</Form.Label>
                      <Form.Control
                        type="number"
                        value={editForm.yieldValue}
                        onChange={(e) => setEditForm((f) => ({ ...f, yieldValue: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12} sm={4}>
                    <Form.Group className="mb-2">
                      <Form.Label>{t('plot.sellingPrice')}</Form.Label>
                      <Form.Control
                        type="number"
                        value={editForm.priceValue}
                        onChange={(e) => setEditForm((f) => ({ ...f, priceValue: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                </>
              )}
            </Row>
            <Button type="submit" size="sm" variant="success" disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </Form>
          <CostSummary computed={plot.computed} />
        </Tab>

        <Tab eventKey="labor" title={t('nav.laborCosts')}>
          <LaborEntry plotId={plotId} seasonId={plot.seasonId} season={season} labor={labor} onChanged={load} />
        </Tab>

        <Tab eventKey="costs" title={t('nav.inputCosts')}>
          <CostEntry plotId={plotId} costs={costs} onChanged={load} />
        </Tab>

        <Tab eventKey="agronomic" title={t('nav.agronomic')}>
          <Row>
            <Col xs={12} md={7}>
              <AgronomicForm plotId={plotId} agronomic={agronomic} onChanged={load} />
            </Col>
            <Col xs={12} md={5}>
              <AgronomicChart agronomic={agronomic} />
            </Col>
          </Row>
        </Tab>

        {isFarmer && (
          <Tab eventKey="yields" title={t('nav.yieldRevenue')}>
            <YieldEntry plotId={plotId} yields={yields} onChanged={load} />
          </Tab>
        )}
      </Tabs>
    </Container>
  );
}
