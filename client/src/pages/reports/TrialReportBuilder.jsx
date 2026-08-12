import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import ReportPreview from './ReportPreview';
import { downloadTrialReport } from '../../utils/pdf';
import { seasonLabel } from '../../utils/formatters';

/** Research Mode only — pick a trial, generate/download a PDF analysis report, and see report history. */
export default function TrialReportBuilder() {
  const { t } = useTranslation();
  const [trials, setTrials] = useState([]);
  const [trialId, setTrialId] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    console.log('TrialReportBuilder: Loading trials...');
    api
      .get('/trials')
      .then(({ data }) => {
        console.log('TrialReportBuilder: Trials loaded, count:', data.trials.length);
        setTrials(data.trials);
      })
      .catch((err) => {
        console.error('TrialReportBuilder: Failed to load trials:', err);
        setError(err.response?.data?.error || { message: err.message });
      })
      .finally(() => {
        console.log('TrialReportBuilder: Trials loading complete');
        setLoading(false);
      });
  }, []);

  const loadReports = () => {
    setLoadingReports(true);
    api
      .get('/reports', { params: { reportType: 'research_analysis' } })
      .then(({ data }) => setReports(data.reports))
      .catch((err) => setError(err.response?.data?.error || { message: err.message }))
      .finally(() => setLoadingReports(false));
  };

  useEffect(() => {
    loadReports();
  }, []);

  const generate = async () => {
    if (!trialId) return;
    setGenerating(true);
    setError(null);
    try {
      const [{ data: trialDetail }, { data: analysis }] = await Promise.all([
        api.get(`/trials/${trialId}`),
        api.get(`/trials/${trialId}/analysis`)
      ]);
      const { trial, setup, season, treatments } = trialDetail;

      const pdfData = await downloadTrialReport({
        trial,
        setup,
        season,
        seasonLabel: season ? seasonLabel(season) : '',
        treatments,
        analysis
      });

      const title = `${trial.crop} — Trial Analysis Report`;
      const reportPayload = {
        setupId: setup?._id,
        trialId,
        reportType: 'research_analysis',
        title,
        snapshot: {
          crop: trial.crop,
          numTreatments: trial.numTreatments,
          numReplicates: trial.numReplicates
        },
        pdfData
      };

      await api.post('/reports', reportPayload);
      loadReports();
    } catch (err) {
      console.error('Trial report generation error:', err);
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Container style={{ maxWidth: 800 }}>
      <h4 className="my-3">{t('report.trialReports')}</h4>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      <div className="border rounded p-3 mb-4 bg-light">
        <Row className="align-items-end g-2">
          <Col xs={12} sm={8}>
            <Form.Group>
              <Form.Label>{t('report.selectTrial')}</Form.Label>
              <Form.Select value={trialId} onChange={(e) => setTrialId(e.target.value)}>
                <option value="">—</option>
                {trials.map(({ trial, setup, season }) => (
                  <option key={trial._id} value={trial._id}>
                    {setup?.name} · {season ? seasonLabel(season) : ''} · {trial.crop}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col xs={12} sm={4}>
            <Button variant="success" onClick={generate} disabled={generating || !trialId}>
              {generating ? t('common.loading') : t('report.generateTrialReport')}
            </Button>
          </Col>
        </Row>
      </div>

      <h5>{t('report.trialReports')}</h5>
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
