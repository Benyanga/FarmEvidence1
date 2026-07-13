import React from 'react';
import Badge from 'react-bootstrap/Badge';
import { useTranslation } from 'react-i18next';

const COLORS = {
  Improving: 'success',
  Declining: 'danger',
  Volatile: 'warning',
  Stable: 'secondary',
  Insufficient: 'light'
};

export default function TrendClassification({ classification }) {
  const { t } = useTranslation();
  return (
    <Badge bg={COLORS[classification] || 'secondary'} text={classification === 'Insufficient' ? 'dark' : undefined}>
      {t(`trend.${classification}`, classification)}
    </Badge>
  );
}
