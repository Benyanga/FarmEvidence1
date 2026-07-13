import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import ReportPreview from './ReportPreview';
import useSetups from '../../hooks/useSetups';
import { downloadSeasonalCBAReport, downloadFarmerSeasonalReport } from '../../utils/pdf';
import { seasonLabel } from '../../utils/formatters';
import { isResearchSetup } from '../../utils/constants';
import i18n from '../../i18n';

function mean(arr) {
  const vals = arr.filter((v) => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/**
 * Renders both the global "/reports" page and the setup-scoped
 * "/seasonal-reports/:setupId" page reached from a farm's sidebar. When
 * scopedSetupId is present, the setup selector is locked and both the
 * report list and Back button stay within that farm.
 */
export default function ReportBuilder() {
  const { t } = useTranslation();
  const { setupId: scopedSetupId } = useParams();
  const { setups } = useSetups();
  const [setupId, setSetupId] = useState(scopedSetupId || '');
  const [setupName, setSetupName] = useState('');
  const [setup, setSetup] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const { data } = await api.get('/reports', scopedSetupId ? { params: { setupId: scopedSetupId } } : undefined);
      setReports(data.reports);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoadingReports(false);
    }
  }, [scopedSetupId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!setupId) return;
    (async () => {
      const { data } = await api.get(`/setups/${setupId}`);
      setSetupName(data.setup.name);
      setSetup(data.setup);
      setSeasons(data.seasons);
      if (data.seasons.length > 0) setSeasonId(data.seasons[data.seasons.length - 1]._id);
    })();
  }, [setupId]);

  const generateResearch = async (season, computeData) => {
    const title = `${seasonLabel(season)} — Seasonal CBA Report`;
    const isCA = computeData.farmingSystem === 'CA';
    const seasonProfit = mean(computeData.plots.map((p) => p.profit));
    const seasonAdoptionCost = mean(computeData.plots.map((p) => p.adoptionCost));

    const snapshot = {
      profitCA: isCA ? seasonProfit : null,
      profitCF: !isCA ? seasonProfit : null,
      adoptionCost: isCA ? seasonAdoptionCost : null,
      csi: computeData.csi,
      ttp: computeData.ttp,
      cnb: computeData.cnb
    };

    await downloadSeasonalCBAReport({ title, seasonLabel: seasonLabel(season), snapshot, plots: computeData.plots });
    return { title, snapshot };
  };

  const generateFarmer = async (season, computeData) => {
    const title = `${seasonLabel(season)} — Seasonal CBA Report`;
    const farmAddress = [setup?.location?.village, setup?.location?.cell, setup?.location?.sector, setup?.location?.district]
      .filter(Boolean)
      .join(', ');

    const { data: seasonData } = await api.get(`/seasons/${season._id}`);
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

    return { title, snapshot: { ...cba, ...totals } };
  };

  const generate = async () => {
    if (!seasonId) return;
    setGenerating(true);
    setError(null);
    try {
      const { data: computeData } = await api.post(`/compute/season/${seasonId}`);
      const season = seasons.find((s) => s._id === seasonId);
      const isFarmer = setup ? !isResearchSetup(setup.setupType) : true;

      const { title, snapshot } = isFarmer ? await generateFarmer(season, computeData) : await generateResearch(season, computeData);

      await api.post('/reports', {
        setupId,
        seasonId,
        reportType: 'seasonal_cba',
        title,
        snapshot,
        language: i18n.language
      });

      await loadReports();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Container style={{ maxWidth: 800 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3">
        <h4 className="mb-0">
          {scopedSetupId ? t('nav.seasonalReports') : t('nav.reports')}
          {scopedSetupId && setupName ? ` — ${setupName}` : ''}
        </h4>
        <Button as={Link} to={scopedSetupId ? `/setups/${scopedSetupId}` : '/dashboard'} variant="secondary" size="sm">
          {t('common.back')}
        </Button>
      </div>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      <div className="border rounded p-3 mb-4 bg-light">
        <Row className="align-items-end g-2">
          {!scopedSetupId && (
            <Col xs={12} sm={6} md={4}>
              <Form.Group>
                <Form.Label>{t('nav.setups')}</Form.Label>
                <Form.Select value={setupId} onChange={(e) => setSetupId(e.target.value)}>
                  <option value="">—</option>
                  {setups.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          )}
          <Col xs={12} sm={6} md={4}>
            <Form.Group>
              <Form.Label>{t('common.season')}</Form.Label>
              <Form.Select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} disabled={!setupId}>
                {seasons.map((s) => (
                  <option key={s._id} value={s._id}>
                    {seasonLabel(s)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Button variant="success" onClick={generate} disabled={generating || !seasonId}>
              {generating ? t('common.loading') : t('report.generate')}
            </Button>
          </Col>
        </Row>
      </div>

      <h5>{scopedSetupId ? t('nav.seasonalReports') : t('nav.reports')}</h5>
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
