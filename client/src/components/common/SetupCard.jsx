import React from 'react';
import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function SetupCard({ setup }) {
  const { t } = useTranslation();

  return (
    <Card className="h-100 shadow-sm">
      <Card.Body>
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-1">
          <Card.Title className="mb-1">{setup.name}</Card.Title>
          <Badge bg={setup.setupType === 'research_trial' ? 'primary' : 'success'}>{t(`setup.${setup.setupType}`)}</Badge>
        </div>
        <Card.Text className="text-muted small mb-2">
          {[setup.location?.district, setup.location?.sector].filter(Boolean).join(', ') || '—'}
        </Card.Text>
        <Card.Text className="small">{setup.soilType || '—'}</Card.Text>
        <Link to={`/setups/${setup._id}`} className="btn btn-sm btn-outline-success">
          {t('common.view')}
        </Link>
      </Card.Body>
    </Card>
  );
}
