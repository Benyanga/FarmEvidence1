import React from 'react';
import { useTranslation } from 'react-i18next';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Table from 'react-bootstrap/Table';
import ScenarioChart from '../../components/charts/ScenarioChart';
import ExplainPanel from '../../components/explainability/ExplainPanel';
import { formatRWF, formatPercent } from '../../utils/formatters';

export default function ScenarioResults({ data }) {
  const { t } = useTranslation();
  if (!data) return null;

  return (
    <Row className="g-3">
      <Col xs={12} md={6}>
        <div className="chart-container" style={{ maxWidth: 420 }}>
          <ScenarioChart scenarios={data.scenarios} />
        </div>
      </Col>
      <Col xs={12} md={6}>
        <Table size="sm" responsive>
          <thead>
            <tr>
              <th></th>
              <th>{t('scenario.probability')}</th>
              <th>{t('cba.profit')}</th>
            </tr>
          </thead>
          <tbody>
            {['best', 'normal', 'worst'].map((key) => (
              <tr key={key}>
                <td>{t(`scenario.${key}`)}</td>
                <td>{formatPercent(data.scenarios[key].probability)}</td>
                <td>{formatRWF(data.scenarios[key].profit)}</td>
              </tr>
            ))}
            <tr className="fw-bold">
              <td colSpan={2}>{t('scenario.expectedProfit')}</td>
              <td>{formatRWF(data.expectedProfit)}</td>
            </tr>
          </tbody>
        </Table>
      </Col>
      <Col xs={12}>
        <ExplainPanel explanation={data.explanation} />
      </Col>
    </Row>
  );
}
