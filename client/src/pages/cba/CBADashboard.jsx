import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import CBAResults from './CBAResults';
import AdoptionCostView from './AdoptionCostView';
import useRole from '../../hooks/useRole';
import useCompute from '../../hooks/useCompute';
import { seasonLabel } from '../../utils/formatters';

function mean(arr) {
  const vals = arr.filter((v) => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Farmer Mode only — Research Mode's analysis lives at /trials/:trialId/analysis instead. */
export default function CBADashboard() {
  const { t } = useTranslation();
  const { seasonId } = useParams();
  const { role } = useRole();
  const simplified = role === 'farmer';

  const [season, setSeason] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const { run, result, loading: computing, error: computeError } = useCompute(`/compute/season/${seasonId}`);
  const isManualRun = useRef(false);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const { data } = await api.get(`/seasons/${seasonId}`);
      setSeason(data.season);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoadingMeta(false);
    }
  }, [seasonId]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!loadingMeta) run().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMeta]);

  // Remember every explicit "Run Computation" as a saved analysis (not the automatic on-load run).
  useEffect(() => {
    if (!result || !season || !isManualRun.current) return;
    isManualRun.current = false;

    const profit = mean(result.plots.map((p) => p.profit));
    const adoptionCost = mean(result.plots.map((p) => p.adoptionCost));

    api
      .post('/reports', {
        setupId: season.setupId,
        seasonId: season._id,
        reportType: 'seasonal_cba',
        title: `${seasonLabel(season)} — ${new Date().toLocaleString()}`,
        snapshot: { profitCA: result.farmingSystem === 'CA' ? profit : null, profitCF: result.farmingSystem === 'CF' ? profit : null, adoptionCost }
      })
      .then(() => {
        setSavedNotice(true);
      })
      .catch(() => {
        // best-effort; the live result is still shown even if history save fails
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const handleRunClick = () => {
    isManualRun.current = true;
    run().catch(() => {});
  };

  if (loadingMeta || (computing && !result)) return <LoadingSpinner />;

  return (
    <Container fluid>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <ErrorAlert error={computeError} />

      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 my-3">
        <h4 className="mb-0">
          {t('nav.cba')} — {season && seasonLabel(season)}
        </h4>
        <div className="d-flex flex-wrap gap-2">
          {season && (
            <Button as={Link} to={`/farms/${season.setupId}/cba-results`} variant="secondary" size="sm">
              {t('common.back')}
            </Button>
          )}
          <Button size="sm" variant="outline-dark" onClick={handleRunClick} disabled={computing}>
            {computing ? t('common.loading') : t('cba.runCompute')}
          </Button>
        </div>
      </div>

      {result && (
        <>
          <CBAResults plots={result.plots} simplified={simplified} mode="farmer" />
          <AdoptionCostView mode="farmer" adoptionCostExplanation={result.adoptionCostExplanation} simplified={simplified} />
        </>
      )}

      <ToastContainer position="bottom-end" className="p-3">
        <Toast bg="success" show={savedNotice} onClose={() => setSavedNotice(false)} delay={3000} autohide>
          <Toast.Body className="text-white">{t('cba.analysisSaved')}</Toast.Body>
        </Toast>
      </ToastContainer>
    </Container>
  );
}
