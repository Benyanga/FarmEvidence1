import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import api from '../../services/api';
import { writeThrough } from '../../services/offline.service';
import ErrorAlert from '../../components/common/ErrorAlert';
import ConfirmModal from '../../components/common/ConfirmModal';
import { INPUT_UNITS } from '../../utils/constants';
import { formatRWF, formatDate } from '../../utils/formatters';
import { computeInputRowTotal, nextLocalId } from '../../utils/costCalc';

function emptyRow() {
  return { localId: nextLocalId(), date: new Date().toISOString().slice(0, 10), inputName: '', unit: 'kg', unitCost: '', quantity: '' };
}

export default function CostEntry({ plotId, costs, onChanged }) {
  const { t } = useTranslation();
  const [draftRows, setDraftRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/costs/${deleteTarget._id}`);
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

  const isRowFilled = (r) => r.inputName.trim() !== '' && r.unitCost !== '' && r.quantity !== '';
  const readyRows = draftRows.filter(isRowFilled);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const row of readyRows) {
        // eslint-disable-next-line no-await-in-loop
        await writeThrough({
          endpoint: `/plots/${plotId}/costs`,
          method: 'POST',
          body: { date: row.date, inputName: row.inputName, unit: row.unit, unitCost: Number(row.unitCost), quantity: Number(row.quantity) }
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

  const total = costs.reduce((sum, c) => sum + (c.totalCost || 0), 0);

  return (
    <div>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <Table size="sm" hover responsive>
        <thead>
          <tr>
            <th>{t('cost.date')}</th>
            <th>{t('cost.inputName')}</th>
            <th>{t('cost.unit')}</th>
            <th>{t('cost.unitCost')}</th>
            <th>{t('cost.quantity')}</th>
            <th>{t('cost.totalCost')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {costs.map((c) => (
            <tr key={c._id}>
              <td>{formatDate(c.date)}</td>
              <td>{c.inputName}</td>
              <td>{c.unit}</td>
              <td>{formatRWF(c.unitCost)}</td>
              <td>{c.quantity}</td>
              <td>{formatRWF(c.totalCost)}</td>
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
                  placeholder={t('cost.inputName')}
                  value={row.inputName}
                  onChange={(e) => updateDraft(row.localId, 'inputName', e.target.value)}
                />
              </td>
              <td>
                <Form.Select size="sm" value={row.unit} onChange={(e) => updateDraft(row.localId, 'unit', e.target.value)}>
                  {INPUT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Form.Select>
              </td>
              <td>
                <Form.Control
                  size="sm"
                  type="number"
                  min={0}
                  value={row.unitCost}
                  onChange={(e) => updateDraft(row.localId, 'unitCost', e.target.value)}
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
              <td className="align-middle">{formatRWF(computeInputRowTotal(row))}</td>
              <td className="align-middle">
                <Button variant="link" size="sm" className="text-danger p-0" onClick={() => removeDraft(row.localId)}>
                  ×
                </Button>
              </td>
            </tr>
          ))}

          <tr className="fw-bold table-light">
            <td colSpan={5}>{t('cost.totalCostOfProduction')}</td>
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
