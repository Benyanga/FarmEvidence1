import React from 'react';
import Card from 'react-bootstrap/Card';
import { useTranslation } from 'react-i18next';

/** Renders a WHAT / WHY / HOW / RECOMMENDATION explanation object from any engine. */
export default function ExplainPanel({ explanation, simplified = false }) {
  const { t } = useTranslation();
  if (!explanation) return null;

  const rows = simplified
    ? [
        ['what', explanation.what],
        ['recommendation', explanation.recommendation]
      ]
    : [
        ['what', explanation.what],
        ['why', explanation.why],
        ['how', explanation.how],
        ['recommendation', explanation.recommendation]
      ];

  return (
    <Card className="mb-3 border-success-subtle">
      <Card.Body>
        {rows.map(([key, value]) =>
          value ? (
            <div key={key} className="mb-2">
              <strong className="text-success">{t(`explain.${key}`)}: </strong>
              <span>{value}</span>
            </div>
          ) : null
        )}
      </Card.Body>
    </Card>
  );
}
