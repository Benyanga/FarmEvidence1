import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import { seasonLabel } from '../../utils/formatters';
import { isResearchSetup } from '../../utils/constants';

/**
 * Research Mode only — lists the Trials nested in this Season (a Season is a
 * pure year/seasonCode time bucket; a season can hold more than one Trial,
 * e.g. different crops/experiments run in the same Season A/2026). Farmer
 * Mode redirects straight to Data Entry (see Sidebar's season-scoped links).
 */
export default function SeasonDetail() {
  const { t } = useTranslation();
  const { seasonId } = useParams();
  const [season, setSeason] = useState(null);
  const [trials, setTrials] = useState([]);
  const [setupType, setSetupType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
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
  }, [load]);

  useEffect(() => {
    if (!season?.setupId) return;
    api.get(`/setups/${season.setupId}`).then(({ data }) => setSetupType(data.setup.setupType)).catch(() => {});
  }, [season?.setupId]);

  useEffect(() => {
    if (!setupType || !isResearchSetup(setupType)) return;
    api
      .get(`/seasons/${seasonId}/trials`)
      .then(({ data }) => setTrials(data.trials))
      .catch((err) => setError(err.response?.data?.error || { message: err.message }));
  }, [seasonId, setupType]);

  if (loading) return <LoadingSpinner />;
  if (!season) return <ErrorAlert error={error || { message: 'Season not found.' }} />;

  if (setupType && !isResearchSetup(setupType)) {
    return <Navigate to={`/seasons/${seasonId}/data-entry`} replace />;
  }

  return (
    <Container>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 my-3">
        <div>
          <h4 className="mb-1">{seasonLabel(season)}</h4>
          <div className="text-muted small">
            {t('season.status')}: <Badge bg="secondary">{season.status}</Badge>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button
            as={Link}
            to={season.year ? `/setups/${season.setupId}/years/${season.year}` : `/setups/${season.setupId}`}
            variant="secondary"
            size="sm"
          >
            {t('common.back')}
          </Button>
          <Button as={Link} to={`/seasons/${seasonId}/trials/new`} variant="success" size="sm">
            + {t('common.add')} {t('trial.trial')}
          </Button>
        </div>
      </div>

      {trials.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <Table hover responsive>
          <thead>
            <tr>
              <th>{t('trial.crop')}</th>
              <th>{t('trial.design')}</th>
              <th>{t('trial.numTreatments')}</th>
              <th>{t('trial.numReplicates')}</th>
              <th>{t('season.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((trial) => (
              <tr key={trial._id}>
                <td>
                  {trial.crop} {trial.variety ? `(${trial.variety})` : ''}
                </td>
                <td>{trial.design}</td>
                <td>{trial.numTreatments}</td>
                <td>{trial.numReplicates}</td>
                <td>
                  <Badge bg="secondary">{trial.status}</Badge>
                </td>
                <td>
                  <Link to={`/trials/${trial._id}`} className="btn btn-sm btn-outline-success">
                    {t('common.view')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Container>
  );
}
