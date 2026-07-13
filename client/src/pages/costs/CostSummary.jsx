import React from 'react';
import { useTranslation } from 'react-i18next';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import CostBreakdownChart from '../../components/charts/CostBreakdownChart';
import { formatRWF } from '../../utils/formatters';

export default function CostSummary({ computed, hideEfficiency = false }) {
  const { t } = useTranslation();

  if (!computed || typeof computed.cSystem !== 'number') {
    return <p className="text-muted">{t('common.noData')}</p>;
  }

  return (
    <Row className="align-items-start">
      <Col xs={12} sm={6} md={5}>
        {!hideEfficiency && (
          <div className="chart-container mx-auto" style={{ maxWidth: 280 }}>
            <CostBreakdownChart breakdown={computed} />
          </div>
        )}
        <ul className="list-unstyled small mt-2">
          {!hideEfficiency && (
            <>
              <li>
                <strong>{t('cba.cSD')}:</strong> {formatRWF(computed.cSD)}
              </li>
              <li>
                <strong>{t('cba.cSI')}:</strong> {formatRWF(computed.cSI)}
              </li>
              <li>
                <strong>{t('cba.cBase')}:</strong> {formatRWF(computed.cBase)}
              </li>
              <li>
                <strong>{t('cba.cSys')}:</strong> {formatRWF(computed.cSys)}
              </li>
              <li>
                <strong>{t('cba.cTime')}:</strong> {formatRWF(computed.cTime)}
              </li>
            </>
          )}
          <li className="border-top pt-1 mt-1">
            <strong>{hideEfficiency ? t('cost.totalCostOfProduction') : t('cba.cSystem')}:</strong> {formatRWF(computed.cSystem)}
          </li>
        </ul>
      </Col>
      <Col xs={12} sm={6} md={7}>
        <ul className="list-unstyled">
          <li>
            <strong>{t('cba.grossMargin')}:</strong> {formatRWF(computed.grossMargin)}
          </li>
          {!hideEfficiency && (
            <li>
              <strong>{t('cba.adjustedGrossMargin')}:</strong> {formatRWF(computed.adjustedGrossMargin)}
            </li>
          )}
          <li>
            <strong>{t('cba.roi')}:</strong> {typeof computed.roi === 'number' ? `${computed.roi.toFixed(1)}%` : '—'}
          </li>
          <li>
            <strong>{t('cba.bcr')}:</strong> {typeof computed.bcr === 'number' ? computed.bcr.toFixed(2) : '—'}
          </li>
          <li>
            <strong>{t('cba.costPerKg')}:</strong> {formatRWF(computed.costPerKg)}
          </li>
          <li>
            <strong>{t('cba.breakEvenYield')}:</strong> {computed.breakEvenYield ?? '—'} kg
          </li>
          <li>
            <strong>{t('cba.yieldMarginOfSafety')}:</strong>{' '}
            {typeof computed.yieldMarginOfSafety === 'number' ? `${computed.yieldMarginOfSafety}%` : '—'}
          </li>
        </ul>
      </Col>
    </Row>
  );
}
