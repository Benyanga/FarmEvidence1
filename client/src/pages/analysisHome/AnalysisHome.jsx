import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import { seasonLabel } from '../../utils/formatters';

/** Research Mode only — every trial the researcher owns, flat, for a direct path into its Analysis dashboard. */
export default function AnalysisHome() {
  const { t } = useTranslation();
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/trials')
      .then(({ data }) => setTrials(data.trials))
      .catch((err) => setError(err.response?.data?.error || { message: err.message }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <Container fluid>
      <h4 className="my-3">{t('nav.analysis')}</h4>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      {trials.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <Table hover responsive>
          <thead>
            <tr>
              <th>{t('trial.setup')}</th>
              <th>{t('trial.season')}</th>
              <th>{t('trial.crop')}</th>
              <th>{t('trial.design')}</th>
              <th>{t('trial.numTreatments')}</th>
              <th>{t('trial.numReplicates')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {trials.map(({ trial, setup, season }) => (
              <tr key={trial._id}>
                <td>{setup?.name || '—'}</td>
                <td>{season ? seasonLabel(season) : '—'}</td>
                <td>
                  {trial.crop} {trial.variety ? `(${trial.variety})` : ''}
                </td>
                <td>{trial.design}</td>
                <td>{trial.numTreatments}</td>
                <td>{trial.numReplicates}</td>
                <td>
                  <Link to={`/trials/${trial._id}/analysis`} className="btn btn-sm btn-outline-dark">
                    {t('trial.viewAnalysis')}
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
