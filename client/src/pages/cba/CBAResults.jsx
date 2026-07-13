import React from 'react';
import { useTranslation } from 'react-i18next';
import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import ExplainPanel from '../../components/explainability/ExplainPanel';
import CostSummary from '../costs/CostSummary';
import { formatRWF } from '../../utils/formatters';

export default function CBAResults({ plots = [], simplified = false, mode = 'research' }) {
  const { t } = useTranslation();

  if (plots.length === 0) return <p className="text-muted">{t('common.noData')}</p>;

  return (
    <>
      {plots.map((plot) => (
        <Card key={plot.plotId} className="mb-3">
          <Card.Header className="d-flex justify-content-between">
            <span>
              {mode === 'research' ? (
                <>
                  <strong>{plot.farmingSystem}</strong> · {t('plot.replicationNumber')} #{plot.replicationNumber}
                </>
              ) : (
                <strong>{t('cba.profit')}</strong>
              )}
            </span>
            {plot.canCompute ? (
              <Badge bg={plot.profit >= 0 ? 'success' : 'danger'}>{formatRWF(plot.profit)}</Badge>
            ) : (
              <Badge bg="warning">{t('common.noData')}</Badge>
            )}
          </Card.Header>
          <Card.Body>
            {plot.canCompute ? (
              <>
                <CostSummary
                  computed={{
                    cBase: plot.cBase,
                    cSD: plot.cSD,
                    cSI: plot.cSI,
                    cSys: plot.cSys,
                    cTime: plot.cTime,
                    cSystem: plot.cSystem,
                    grossMargin: plot.grossMargin,
                    adjustedGrossMargin: plot.adjustedGrossMargin,
                    bcr: plot.bcr,
                    roi: plot.roi,
                    costPerKg: plot.costPerKg,
                    breakEvenYield: plot.breakEvenYield,
                    yieldMarginOfSafety: plot.yieldMarginOfSafety
                  }}
                  hideEfficiency={mode !== 'research'}
                />
                <div className="mt-2">
                  <strong>{t('cba.revenue')}:</strong> {formatRWF(plot.revenue)}
                </div>
              </>
            ) : (
              <div className="text-muted small">Missing: {plot.missingData.join(', ')}</div>
            )}
            <ExplainPanel explanation={plot.explanation} simplified={simplified} />
          </Card.Body>
        </Card>
      ))}
    </>
  );
}
