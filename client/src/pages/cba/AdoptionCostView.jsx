import React from 'react';
import { useTranslation } from 'react-i18next';
import Card from 'react-bootstrap/Card';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import ExplainPanel from '../../components/explainability/ExplainPanel';
import { formatRWF } from '../../utils/formatters';

export default function AdoptionCostView({ mode, ttp, ttpExplanation, cnb, cnbExplanation, adoptionCostExplanation, simplified = false }) {
  const { t } = useTranslation();

  return (
    <Card className="mb-3">
      <Card.Header>{t('cba.adoptionCost')}</Card.Header>
      <Card.Body>
        <ExplainPanel explanation={adoptionCostExplanation} simplified={simplified} />

        {mode === 'research' && (
          <Row className="text-center mt-3 g-2">
            <Col xs={12} sm={6}>
              <div className="border rounded p-3">
                <div className="text-muted small">{t('cba.ttp')}</div>
                <div className="fs-4">{ttp !== null && ttp !== undefined ? `Season ${ttp}` : '—'}</div>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div className="border rounded p-3">
                <div className="text-muted small">{t('cba.cnb')}</div>
                <div className="fs-4">{cnb !== null && cnb !== undefined ? formatRWF(cnb) : '—'}</div>
              </div>
            </Col>
          </Row>
        )}

        {mode === 'research' && <ExplainPanel explanation={ttpExplanation} simplified={simplified} />}
        {mode === 'research' && <ExplainPanel explanation={cnbExplanation} simplified={simplified} />}
      </Card.Body>
    </Card>
  );
}
