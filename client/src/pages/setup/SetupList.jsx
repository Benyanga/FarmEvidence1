import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import useSetups from '../../hooks/useSetups';
import useRole from '../../hooks/useRole';
import SetupCard from '../../components/common/SetupCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';

export default function SetupList() {
  const { t } = useTranslation();
  const { setups, loading, error } = useSetups();
  const { role } = useRole();

  const isResearcher = role === 'researcher';
  const researchSetups = setups.filter((s) => s.setupType === 'research_trial');

  // Research Mode has (almost always) a single site — skip straight to its
  // year list instead of making the researcher pick from a one-item list.
  if (isResearcher && !loading && researchSetups.length === 1) {
    return <Navigate to={`/setups/${researchSetups[0]._id}`} replace />;
  }

  const visibleSetups = isResearcher ? researchSetups : setups;

  return (
    <Container>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3">
        <h4 className="mb-0">{t('nav.setups')}</h4>
        <Button as={Link} to="/setups/new" variant="success" size="sm">
          + {t('dashboard.createSetup')}
        </Button>
      </div>
      <ErrorAlert error={error} />
      {loading ? (
        <LoadingSpinner />
      ) : visibleSetups.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <Row className="g-3">
          {visibleSetups.map((setup) => (
            <Col xs={12} sm={6} lg={4} key={setup._id}>
              <SetupCard setup={setup} />
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}
