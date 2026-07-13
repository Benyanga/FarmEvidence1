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
import { computeInputRowTotal, nextLocalId } from '../../utils/costCalc';

function emptyRow() {
  return { localId: nextLocalId(), date: new Date().toISOString().slice(0, 10), inputItem: '', costType: 'C_SI', unit: 'kg', unitCostRwf: '', quantity: '' };
}

/** Research Mode only — Input Cost log for a TrialPlot. costType is recorder-supplied (never auto-classified). */
export default function TrialInputCostEntry({ trialPlotId, costs, onChanged }) {
  const { t } = useTranslation();
  const [draftRows, setDraftRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/trial-input-costs/${deleteTarget._id}`);
      setDeleteTarget(null);
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    }
  };

  const updateDraft = (localId, field, value) => {
    setDraftRows((rows) => rows.map((r) => (r.localId === localId ? { ...r, [field]: value } : r)));
  };
  const removeDraft = (localId) => setDraftRows((rows) => rows.filter((r) => r.localId !== localId));
  const addDraft = () => setDraftRows((rows) => [...rows, emptyRow()]);

  const isRowFilled = (r) => r.inputItem.trim() !== '' && r.unitCostRwf !== '' && r.quantity !== '';
  const readyRows = draftRows.filter(isRowFilled);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const row of readyRows) {
        // eslint-disable-next-line no-await-in-loop
        await writeThrough({
          endpoint: `/trial-plots/${trialPlotId}/input-costs`,
          method: 'POST',
          body: {
            date: row.date,
            inputItem: row.inputItem,
            costType: row.costType,
            unit: row.unit,
            unitCostRwf: Number(row.unitCostRwf),
            quantity: Number(row.quantity)
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

  const total = costs.reduce((sum, c) => sum + (c.totalCostRwf || 0), 0);

  return (
    <div>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <Table size="sm" hover responsive>
        <thead>
          <tr>
            <th>{t('cost.date')}</th>
            <th>{t('trial.inputItem')}</th>
            <th>{t('cost.costClass')}</th>
            <th>{t('cost.unit')}</th>
            <th>{t('trial.unitCostRwf')}</th>
            <th>{t('cost.quantity')}</th>
            <th>{t('cost.totalCost')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {costs.map((c) => (
            <tr key={c._id}>
              <td>{formatDate(c.date)}</td>
              <td>{c.inputItem}</td>
              <td>{t(`cost.${c.costType}`)}</td>
              <td>{c.unit}</td>
              <td>{formatRWF(c.unitCostRwf)}</td>
              <td>{c.quantity}</td>
              <td>{formatRWF(c.totalCostRwf)}</td>
              <td>
                <Button variant="link" size="sm" className="text-danger p-0" onClick={() => setDeleteTarget(c)}>
                  {t('common.delete')}
                </Button>
              </td>
            </tr>
          ))}

          {draftRows.map((row) => (
            <tr key={row.localId} className="table-light">
              <td>
                <Form.Control size="sm" type="date" value={row.date} onChange={(e) => updateDraft(row.localId, 'date', e.target.value)} />
              </td>
              <td>
                <Form.Control
                  size="sm"
                  placeholder={t('trial.inputItem')}
                  value={row.inputItem}
                  onChange={(e) => updateDraft(row.localId, 'inputItem', e.target.value)}
                />
              </td>
              <td>
                <Form.Select size="sm" value={row.costType} onChange={(e) => updateDraft(row.localId, 'costType', e.target.value)}>
                  <option value="C_SD">{t('cost.C_SD')}</option>
                  <option value="C_SI">{t('cost.C_SI')}</option>
                </Form.Select>
              </td>
              <td>
                <Form.Control size="sm" value={row.unit} onChange={(e) => updateDraft(row.localId, 'unit', e.target.value)} />
              </td>
              <td>
                <Form.Control
                  size="sm"
                  type="number"
                  min={0}
                  value={row.unitCostRwf}
                  onChange={(e) => updateDraft(row.localId, 'unitCostRwf', e.target.value)}
                />
              </td>
              <td>
                <Form.Control
                  size="sm"
                  type="number"
                  min={0}
                  value={row.quantity}
                  onChange={(e) => updateDraft(row.localId, 'quantity', e.target.value)}
                />
              </td>
              <td className="align-middle">{formatRWF(computeInputRowTotal({ unitCost: row.unitCostRwf, quantity: row.quantity }))}</td>
              <td className="align-middle">
                <Button variant="link" size="sm" className="text-danger p-0" onClick={() => removeDraft(row.localId)}>
                  ×
                </Button>
              </td>
            </tr>
          ))}

          <tr className="fw-bold table-light">
            <td colSpan={6}>{t('trial.subtotalInputCosts')}</td>
            <td>{formatRWF(total)}</td>
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
