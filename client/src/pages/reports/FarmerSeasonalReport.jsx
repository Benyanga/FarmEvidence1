import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import ReportPreview from './ReportPreview';
import { downloadFarmerSeasonalReport } from '../../utils/pdf';
import { seasonLabel } from '../../utils/formatters';
import i18n from '../../i18n';

function mean(arr) {
  const vals = arr.filter((v) => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Farmer Mode Seasonal Report — scoped to a single season, reached via that season's sidebar. */
export default function FarmerSeasonalReport() {
  const { t } = useTranslation();
  const { seasonId } = useParams();
  const [season, setSeason] = useState(null);
  const [setup, setSetup] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const { data } = await api.get('/reports', { params: { seasonId, reportType: 'seasonal_cba' } });
      setReports(data.reports);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoadingReports(false);
    }
  }, [seasonId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/seasons/${seasonId}`);
      setSeason(data.season);
      const setupRes = await api.get(`/setups/${data.season.setupId}`);
      setSetup(setupRes.data.setup);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    load();
    loadReports();
  }, [load, loadReports]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data: computeData } = await api.post(`/compute/season/${seasonId}`);
      const title = `${seasonLabel(season)} — Seasonal CBA Report`;
      const farmAddress = [setup?.location?.village, setup?.location?.cell, setup?.location?.sector, setup?.location?.district]
        .filter(Boolean)
        .join(', ');

      const { data: seasonData } = await api.get(`/seasons/${seasonId}`);
      const plotDetails = await Promise.all(seasonData.plots.map((p) => api.get(`/plots/${p._id}`).then((r) => r.data)));

      const inputCosts = plotDetails.flatMap((d) => d.costs);
      const laborCosts = plotDetails.flatMap((d) => d.labor);
      const yields = plotDetails.flatMap((d) => d.yields || []);

      const inputCostTotal = inputCosts.reduce((s, c) => s + (c.totalCost || 0), 0);
      const laborCostTotal = laborCosts.reduce((s, l) => s + (l.laborCost || 0), 0);
      const totalRevenue = yields.reduce((s, y) => s + (y.totalRevenue || 0), 0);

      const cba = {
        grossMargin: mean(computeData.plots.map((p) => p.grossMargin)),
        roi: mean(computeData.plots.map((p) => p.roi)),
        bcr: mean(computeData.plots.map((p) => p.bcr)),
        costPerKg: mean(computeData.plots.map((p) => p.costPerKg)),
        breakEvenYield: mean(computeData.plots.map((p) => p.breakEvenYield)),
        yieldMarginOfSafety: mean(computeData.plots.map((p) => p.yieldMarginOfSafety)),
        adoptionCost: mean(computeData.plots.map((p) => p.adoptionCost))
      };

      const totals = { inputCostTotal, laborCostTotal, totalCostOfProduction: inputCostTotal + laborCostTotal, totalRevenue };

      await downloadFarmerSeasonalReport({
        title,
        farmAddress: farmAddress || '—',
        seasonLabel: seasonLabel(season),
        inputCosts,
        laborCosts,
        yields,
        totals,
        cba
      });

      await api.post('/reports', {
        setupId: setup._id,
        seasonId,
        reportType: 'seasonal_cba',
        title,
        snapshot: { ...cba, ...totals },
        language: i18n.language
      });

      await loadReports();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!season) return <ErrorAlert error={error || { message: 'Season not found.' }} />;

  return (
    <Container fluid>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3">
        <h4 className="mb-0">
          {t('nav.seasonalReports')} — {seasonLabel(season)}
        </h4>
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} to={`/farms/${season.setupId}/seasonal-reports`} variant="secondary" size="sm">
            {t('common.back')}
          </Button>
          <Button variant="success" size="sm" onClick={generate} disabled={generating}>
            {generating ? t('common.loading') : t('report.generate')}
          </Button>
        </div>
      </div>

      {loadingReports ? (
        <LoadingSpinner />
      ) : reports.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        reports.map((r) => <ReportPreview key={r._id} report={r} />)
      )}
    </Container>
  );
}
