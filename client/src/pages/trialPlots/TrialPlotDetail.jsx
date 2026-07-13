import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Button from 'react-bootstrap/Button';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import TrialInputCostEntry from './TrialInputCostEntry';
import TrialLabourCostEntry from './TrialLabourCostEntry';
import TrialYieldEntry from './TrialYieldEntry';
import TrialPlotSummary from './TrialPlotSummary';

/** Research Mode only — per-TrialPlot workspace: Input Costs / Labour Costs / Yield & Revenue. */
export default function TrialPlotDetail() {
  const { t } = useTranslation();
  const { id: trialPlotId } = useParams();
  const [plot, setPlot] = useState(null);
  const [treatment, setTreatment] = useState(null);
  const [rollup, setRollup] = useState(null);
  const [yieldEntry, setYieldEntry] = useState(null);
  const [trial, setTrial] = useState(null);
  const [inputCosts, setInputCosts] = useState([]);
  const [labourCosts, setLabourCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/trial-plots/${trialPlotId}`);
      setPlot(data.plot);
      setTreatment(data.treatment);
      setRollup(data.rollup);
      setYieldEntry(data.yield);

      const [trialRes, inputRes, labourRes] = await Promise.all([
        api.get(`/trials/${data.plot.trialId}`),
        api.get(`/trial-plots/${trialPlotId}/input-costs`),
        api.get(`/trial-plots/${trialPlotId}/labour-costs`)
      ]);
      setTrial(trialRes.data.trial);
      setInputCosts(inputRes.data.costs);
      setLabourCosts(labourRes.data.labour);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, [trialPlotId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingSpinner />;
  if (!plot) return <ErrorAlert error={error || { message: 'Trial plot not found.' }} />;

  return (
    <Container>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3">
        <h4 className="mb-0">
          {treatment?.code} — {t('trial.replicate')} {plot.replicateNumber}
        </h4>
        <Button as={Link} to={`/trials/${plot.trialId}`} variant="secondary" size="sm">
          {t('common.back')}
        </Button>
      </div>

      <Tabs defaultActiveKey="overview" className="mb-3">
        <Tab eventKey="overview" title={t('common.view')}>
          <TrialPlotSummary rollup={rollup} />
        </Tab>
        <Tab eventKey="inputCosts" title={t('nav.inputCosts')}>
          <TrialInputCostEntry trialPlotId={trialPlotId} costs={inputCosts} onChanged={load} />
        </Tab>
        <Tab eventKey="labourCosts" title={t('nav.laborCosts')}>
          <TrialLabourCostEntry trialPlotId={trialPlotId} trial={trial} labour={labourCosts} onChanged={load} />
        </Tab>
        <Tab eventKey="yield" title={t('nav.yieldRevenue')}>
          <TrialYieldEntry trialPlotId={trialPlotId} trial={trial} yieldEntry={yieldEntry} onChanged={load} />
        </Tab>
      </Tabs>
    </Container>
  );
}
