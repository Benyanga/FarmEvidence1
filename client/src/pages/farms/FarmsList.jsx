import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import useSetups from '../../hooks/useSetups';
import SetupCard from '../../components/common/SetupCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';

/** Farmer Mode only — create farms and see every farm already created. No season or data-entry here; see Data Entry. */
export default function FarmsList() {
  const { t } = useTranslation();
  const { setups, loading, error } = useSetups();

  const farms = setups.filter((s) => s.setupType !== 'research_trial');

  return (
    <Container>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3">
        <h4 className="mb-0">{t('nav.farms')}</h4>
        <Button as={Link} to="/setups/new" variant="success" size="sm">
          + {t('dashboard.createFarm')}
        </Button>
      </div>
      <ErrorAlert error={error} />
      {loading ? (
        <LoadingSpinner />
      ) : farms.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <Row className="g-3">
          {farms.map((setup) => (
            <Col xs={12} sm={6} lg={4} key={setup._id}>
              <SetupCard setup={setup} />
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}
