import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import api from '../../services/api';
import { formatRWF, formatDate } from '../../utils/formatters';
import PdfViewer from '../../components/PdfViewer';
import ConfirmModal from '../../components/common/ConfirmModal';
import ErrorAlert from '../../components/common/ErrorAlert';

/** onDeleted: called after the report is successfully deleted server-side, so the parent can refresh its list. */
export default function ReportPreview({ report, onDeleted }) {
  const { t } = useTranslation();
  const s = report.snapshot || {};
  const [showViewer, setShowViewer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/reports/${report._id}`);
      setShowDeleteConfirm(false);
      onDeleted?.(report._id);
    } catch (err) {
      setDeleteError(err.response?.data?.error || { message: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="mb-2">
        <Card.Body>
          {deleteError && <ErrorAlert error={deleteError} onClose={() => setDeleteError(null)} />}
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="flex-grow-1">
              <strong>{report.title}</strong>
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
            </div>
            <div className="d-flex gap-2">
              {report.pdfData && (
                <Button variant="primary" size="sm" onClick={() => setShowViewer(true)}>
                  View
                </Button>
              )}
              <Button variant="outline-danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                Delete
              </Button>
              <Badge bg="secondary">{report.reportType}</Badge>
            </div>
          </div>
        </Card.Body>
      </Card>

      {report.pdfData && (
        <PdfViewer
          title={report.title}
          pdfData={report.pdfData}
          show={showViewer}
          onHide={() => setShowViewer(false)}
        />
      )}

      <ConfirmModal
        show={showDeleteConfirm}
        onConfirm={confirmDelete}
        onCancel={() => (deleting ? null : setShowDeleteConfirm(false))}
      />
    </>
  );
}
