import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import useSetups from '../../hooks/useSetups';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';

/** Farmer Mode only — every farm, for a direct path into a season's CBA Results. */
export default function CbaResultsHome() {
  const { t } = useTranslation();
  const { setups, loading, error } = useSetups();
  const farms = setups.filter((s) => s.setupType !== 'research_trial');

  if (loading) return <LoadingSpinner />;

  return (
    <Container>
      <h4 className="my-3">{t('nav.cbaResults')}</h4>
      <ErrorAlert error={error} />

      {farms.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <Table hover responsive>
          <thead>
            <tr>
              <th>{t('setup.name')}</th>
              <th>{t('setup.district')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {farms.map((setup) => (
              <tr key={setup._id}>
                <td>{setup.name}</td>
                <td>{setup.location?.district || '—'}</td>
                <td>
                  <Link to={`/farms/${setup._id}/cba-results`} className="btn btn-sm btn-outline-success">
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
