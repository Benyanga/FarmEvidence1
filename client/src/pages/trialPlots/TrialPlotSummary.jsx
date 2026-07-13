import React from 'react';
import { useTranslation } from 'react-i18next';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { formatRWF } from '../../utils/formatters';

/** Research Mode only — presentational roll-up for a TrialPlot (§11.2 in COMPUTATION_ENGINE.md). */
export default function TrialPlotSummary({ rollup }) {
  const { t } = useTranslation();

  if (!rollup || typeof rollup.totalProductionCost !== 'number') {
    return <p className="text-muted">{t('common.noData')}</p>;
  }

  return (
    <Row className="align-items-start">
      <Col xs={12} sm={6}>
        <ul className="list-unstyled small">
          <li>
            <strong>{t('trial.subtotalInputCosts')}:</strong> {formatRWF(rollup.subtotalInputCosts)}
          </li>
          <li>
            <strong>{t('trial.subtotalLabourCosts')}:</strong> {formatRWF(rollup.subtotalLabourCosts)}
          </li>
          <li>
            <strong>{t('cost.C_SD')}:</strong> {formatRWF(rollup.cSDTotal)}
          </li>
          <li>
            <strong>{t('cost.C_SI')}:</strong> {formatRWF(rollup.cSITotal)}
          </li>
          <li className="border-top pt-1 mt-1">
            <strong>{t('trial.totalProductionCost')}:</strong> {formatRWF(rollup.totalProductionCost)}
          </li>
          <li>
            <strong>{t('trial.costPerM2')}:</strong> {formatRWF(rollup.costPerM2)}
          </li>
          <li>
            <strong>{t('trial.costPerHa')}:</strong> {formatRWF(rollup.costPerHa)}
          </li>
        </ul>
      </Col>
      <Col xs={12} sm={6}>
        <ul className="list-unstyled">
          <li>
            <strong>{t('trial.netBenefit')}:</strong> {formatRWF(rollup.netBenefit)}
          </li>
          <li>
            <strong>{t('cba.adjustedGrossMargin')}:</strong> {formatRWF(rollup.adjustedGrossMargin)}
          </li>
          <li>
            <strong>{t('cba.bcr')}:</strong> {typeof rollup.bcr === 'number' ? rollup.bcr.toFixed(2) : '—'}
          </li>
          <li>
            <strong>{t('cba.roi')}:</strong> {typeof rollup.roi === 'number' ? `${rollup.roi.toFixed(1)}%` : '—'}
          </li>
          <li>
            <strong>{t('cba.costPerKg')}:</strong> {formatRWF(rollup.costPerKg)}
          </li>
        </ul>
      </Col>
    </Row>
  );
}
