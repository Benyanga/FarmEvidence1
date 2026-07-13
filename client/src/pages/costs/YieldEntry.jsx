import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import api from '../../services/api';
import { writeThrough } from '../../services/offline.service';
import ErrorAlert from '../../components/common/ErrorAlert';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatRWF, formatDate } from '../../utils/formatters';
import { computeYieldRowPreview, nextLocalId } from '../../utils/costCalc';

function emptyRow() {
  return { localId: nextLocalId(), date: new Date().toISOString().slice(0, 10), yieldHarvested: '', yieldSold: '', marketPrice: '' };
}

export default function YieldEntry({ plotId, yields, onChanged }) {
  const { t } = useTranslation();
  const [draftRows, setDraftRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/yields/${deleteTarget._id}`);
      setDeleteTarget(null);
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    }
  };

  const updateDraft = (localId, field, value) => {
    setDraftRows((rows) => rows.map((r) => (r.localId === localId ? { ...r, [field]: value } : r)));
  };

  const removeDraft = (localId) => {
    setDraftRows((rows) => rows.filter((r) => r.localId !== localId));
  };

  const addDraft = () => setDraftRows((rows) => [...rows, emptyRow()]);

  const isRowFilled = (r) => Number(r.yieldHarvested) > 0 || Number(r.yieldSold) > 0;
  const readyRows = draftRows.filter(isRowFilled);

  const lastSavedRemaining = yields.length ? yields[yields.length - 1].remainingYield : 0;

  // Chain the running balance preview across drafts, in entry order.
  const draftPreviews = [];
  let runningRemaining = lastSavedRemaining;
  for (const row of draftRows) {
    const preview = computeYieldRowPreview({
      prevRemaining: runningRemaining,
      yieldHarvested: row.yieldHarvested,
      yieldSold: row.yieldSold,
      marketPrice: row.marketPrice
    });
    draftPreviews.push(preview);
    runningRemaining = preview.remainingYield;
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const row of readyRows) {
        // eslint-disable-next-line no-await-in-loop
        await writeThrough({
          endpoint: `/plots/${plotId}/yields`,
          method: 'POST',
          body: {
            date: row.date,
            yieldHarvested: row.yieldHarvested ? Number(row.yieldHarvested) : 0,
            yieldSold: row.yieldSold ? Number(row.yieldSold) : 0,
            marketPrice: row.marketPrice ? Number(row.marketPrice) : undefined
          }
        });
      }
      setDraftRows([emptyRow()]);
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const totalHarvested = yields.reduce((s, y) => s + (y.yieldHarvested || 0), 0);
  const totalSold = yields.reduce((s, y) => s + (y.yieldSold || 0), 0);
  const totalRevenue = yields.reduce((s, y) => s + (y.totalRevenue || 0), 0);
  const remaining = yields.length ? yields[yields.length - 1].remainingYield : 0;

  return (
    <div>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <p className="text-muted small mb-2">{t('yield.ledgerHint')}</p>

      <Table size="sm" hover responsive>
        <thead>
          <tr>
            <th>{t('cost.date')}</th>
            <th>{t('yield.yieldHarvested')}</th>
            <th>{t('yield.yieldSold')}</th>
            <th>{t('yield.remainingYield')}</th>
            <th>{t('yield.marketPrice')}</th>
            <th>{t('yield.totalRevenue')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {yields.map((y) => (
            <tr key={y._id}>
              <td>{formatDate(y.date)}</td>
              <td>{y.yieldHarvested || '—'}</td>
              <td>{y.yieldSold || '—'}</td>
              <td>{y.remainingYield}</td>
              <td>{y.marketPrice ? formatRWF(y.marketPrice) : '—'}</td>
              <td>{formatRWF(y.totalRevenue)}</td>
              <td>
                <Button variant="link" size="sm" className="text-danger p-0" onClick={() => setDeleteTarget(y)}>
                  {t('common.delete')}
                </Button>
              </td>
            </tr>
          ))}

          {draftRows.map((row, i) => (
            <tr key={row.localId} className="table-light">
              <td>
                <Form.Control size="sm" type="date" value={row.date} onChange={(e) => updateDraft(row.localId, 'date', e.target.value)} />
              </td>
              <td>
                <Form.Control
                  size="sm"
                  type="number"
                  min={0}
                  value={row.yieldHarvested}
                  onChange={(e) => updateDraft(row.localId, 'yieldHarvested', e.target.value)}
                />
              </td>
              <td>
                <Form.Control
                  size="sm"
                  type="number"
                  min={0}
                  value={row.yieldSold}
                  onChange={(e) => updateDraft(row.localId, 'yieldSold', e.target.value)}
                />
              </td>
              <td className="align-middle">{draftPreviews[i].remainingYield}</td>
              <td>
                <Form.Control
                  size="sm"
                  type="number"
                  min={0}
                  value={row.marketPrice}
                  onChange={(e) => updateDraft(row.localId, 'marketPrice', e.target.value)}
                />
              </td>
              <td className="align-middle">{formatRWF(draftPreviews[i].totalRevenue)}</td>
              <td className="align-middle">
                <Button variant="link" size="sm" className="text-danger p-0" onClick={() => removeDraft(row.localId)}>
                  ×
                </Button>
              </td>
            </tr>
          ))}

          <tr className="fw-bold table-light">
            <td>{t('common.total')}</td>
            <td>{totalHarvested}</td>
            <td>{totalSold}</td>
            <td>{remaining}</td>
            <td />
            <td>{formatRWF(totalRevenue)}</td>
            <td />
          </tr>
        </tbody>
      </Table>

      <div className="d-flex flex-wrap gap-2">
        <Button variant="outline-success" size="sm" onClick={addDraft}>
          + {t('common.add')}
        </Button>
        <Button variant="success" size="sm" onClick={save} disabled={saving || readyRows.length === 0}>
          {saving ? t('common.loading') : t('common.save')}
        </Button>
      </div>

      <ConfirmModal
        show={Boolean(deleteTarget)}
        message={t('common.confirmDelete')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
