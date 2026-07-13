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
import CBASummaryTable from './CBASummaryTable';
import CostStructureTable from './CostStructureTable';
import DescriptiveStatsTable from './DescriptiveStatsTable';
import AnovaTable from './AnovaTable';
import TTestCard from './TTestCard';
import RiskStabilityView from './RiskStabilityView';
import BreakEvenTable from './BreakEvenTable';
import SensitivityPanel from './SensitivityPanel';
import PartialBudgetPanel from './PartialBudgetPanel';

/**
 * Research Mode only — the Trial's full analysis dashboard. Always computed
 * live from `GET /trials/:trialId/analysis` (never cached) per the
 * "no manual refresh" rule in COMPUTATION_ENGINE.md §11.
 */
export default function TrialAnalysisDashboard() {
  const { t } = useTranslation();
  const { trialId } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, trialRes] = await Promise.all([api.get(`/trials/${trialId}/analysis`), api.get(`/trials/${trialId}`)]);
      setAnalysis(data);
      setTreatments(trialRes.data.treatments);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, [trialId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingSpinner />;

  return (
    <Container fluid style={{ maxWidth: 1100 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3">
        <h4 className="mb-0">
          {t('trial.viewAnalysis')} {analysis ? `— ${analysis.trial.crop}` : ''}
        </h4>
        <Button as={Link} to={`/trials/${trialId}`} variant="secondary" size="sm">
          {t('common.back')}
        </Button>
      </div>

      <ErrorAlert error={error} />

      {analysis && (
        <Tabs defaultActiveKey="cba" className="mb-3">
          <Tab eventKey="cba" title={t('nav.cba')}>
            <CBASummaryTable summary={analysis.cbaSummary?.summary} comparisons={analysis.cbaSummary?.comparisons} />
          </Tab>
          <Tab eventKey="costStructure" title={t('research.costStructure')}>
            <CostStructureTable costStructure={analysis.costStructure} />
          </Tab>
          <Tab eventKey="statistics" title={t('nav.statistics')}>
            <DescriptiveStatsTable descriptiveStats={analysis.descriptiveStats} />
            <AnovaTable anova={analysis.anova} />
            <TTestCard tTest={analysis.tTest} />
          </Tab>
          <Tab eventKey="risk" title={t('trial.riskStability')}>
            <RiskStabilityView riskStability={analysis.riskStability} />
          </Tab>
          <Tab eventKey="breakEven" title={t('trial.breakEven')}>
            <BreakEvenTable breakEven={analysis.breakEven} />
          </Tab>
          <Tab eventKey="sensitivity" title={t('research.sensitivity')}>
            <SensitivityPanel trialId={trialId} sensitivity={analysis.sensitivity} />
          </Tab>
          <Tab eventKey="partialBudget" title={t('research.partialBudget')}>
            <PartialBudgetPanel trialId={trialId} treatments={treatments} />
          </Tab>
        </Tabs>
      )}
    </Container>
  );
}
