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

/** Farmer Mode Seasonal Report — scoped to a single season, reached via that season's sidebar. */
export default function FarmerSeasonalReport() {
  const { t } = useTranslation();
  const { seasonId } = useParams();
  const [season, setSeason] = useState(null);
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
      // getFarmerDashboard recomputes season/plot figures itself — no separate /compute call needed.
      const { data: dash } = await api.get(`/seasons/${seasonId}/dashboard`);
      const { season: s, setup: su, plot, seasonHistory } = dash;

      const { data: plotDetail } = await api.get(`/plots/${plot._id}`);
      const inputCosts = plotDetail.costs || [];
      const laborCosts = plotDetail.labor || [];

      const location = [su?.location?.village, su?.location?.cell, su?.location?.sector, su?.location?.district].filter(Boolean).join(', ');
      const priorSeasons = (seasonHistory || [])
        .filter((h) => h.season < s.seasonNumber)
        .sort((a, b) => b.season - a.season);

      const profit = plot.computed?.profit ?? 0;
      const revenue = plot.revenue ?? 0;
      const cost = plot.computed?.cSystem ?? 0;
      const harvestKg = plot.yield?.value ?? 0;
      const profitPerHa = plot.plotArea ? profit / plot.plotArea : null;

      const title = `${su.name} — Seasonal Report`;

      const pdfData = await downloadFarmerSeasonalReport({
        farmerName: su.name,
        system: s.farmingSystem,
        crop: s.cropType,
        seasonLabel: seasonLabel(s),
        location: location || undefined,
        harvestKg,
        revenue,
        cost,
        profit,
        profitPerHa,
        bcr: plot.computed?.bcr,
        costPerKg: plot.computed?.costPerKg,
        breakEvenYield: plot.computed?.breakEvenYield,
        inputCosts,
        laborCosts,
        priorSeasons,
        cooperativeAvgProfit: null
      });

      await api.post('/reports', {
        setupId: su._id,
        seasonId,
        reportType: 'seasonal_cba',
        title,
        snapshot: { profit, revenue, cost, bcr: plot.computed?.bcr, costPerKg: plot.computed?.costPerKg, breakEvenYield: plot.computed?.breakEvenYield },
        language: i18n.language,
        pdfData
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
        reports.map((r) => <ReportPreview key={r._id} report={r} onDeleted={loadReports} />)
      )}
    </Container>
  );
}
