import React from 'react';
import { useTranslation } from 'react-i18next';
import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import { formatRWF, formatDate } from '../../utils/formatters';

export default function ReportPreview({ report }) {
  const { t } = useTranslation();
  const s = report.snapshot || {};

  return (
    <Card className="mb-2">
      <Card.Body>
        <div className="d-flex justify-content-between">
          <strong>{report.title}</strong>
          <Badge bg="secondary">{report.reportType}</Badge>
        </div>
        <div className="text-muted small mb-2">{formatDate(report.createdAt)}</div>
        {report.reportType === 'research_analysis' ? (
          <div className="small">
            {s.crop} · {t('trial.numTreatments')}: {s.numTreatments ?? '—'} · {t('trial.numReplicates')}: {s.numReplicates ?? '—'}
          </div>
        ) : typeof s.grossMargin === 'number' ? (
          <div className="small">
            {t('cba.grossMargin')}: {formatRWF(s.grossMargin)} · {t('cba.roi')}: {typeof s.roi === 'number' ? `${s.roi.toFixed(1)}%` : '—'} ·{' '}
            {t('cba.bcr')}: {typeof s.bcr === 'number' ? s.bcr.toFixed(2) : '—'}
          </div>
        ) : (
          <div className="small">
            {t('cba.profit')} (CA): {formatRWF(s.profitCA)} · {t('cba.profit')} (CF): {formatRWF(s.profitCF)} · CSI: {s.csi ?? '—'}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
