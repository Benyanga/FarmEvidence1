import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import useSetups from '../../hooks/useSetups';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';

/** Farmer Mode only — every farm, for a direct path into recording its seasons' data. */
export default function FarmerDataEntryHome() {
  const { t } = useTranslation();
  const { setups, loading, error } = useSetups();
  const farms = setups.filter((s) => s.setupType !== 'research_trial');

  if (loading) return <LoadingSpinner />;

  return (
    <Container>
      <h4 className="my-3">{t('nav.dataEntry')}</h4>
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
                  <Link to={`/farms/${setup._id}/data-entry`} className="btn btn-sm btn-outline-success">
                    {t('common.recordData')}
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
