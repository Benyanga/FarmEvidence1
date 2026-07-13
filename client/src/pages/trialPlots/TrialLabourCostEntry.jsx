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
import { nextLocalId } from '../../utils/costCalc';

function emptyRow() {
  return { localId: nextLocalId(), date: new Date().toISOString().slice(0, 10), practice: '', costType: 'C_SD', numLabourers: 1, timeValue: '', timeUnit: 'hr' };
}

function previewTotal({ timeValue, timeUnit, numLabourers, wageRatePerDayRwf, workingHoursPerDay = 8 }) {
  const value = Number(timeValue);
  const labourers = Number(numLabourers);
  const wage = Number(wageRatePerDayRwf);
  if (!(value >= 0) || !(labourers >= 0) || !(wage >= 0)) return null;
  const factor = { min: 1, hr: 60, sec: 1 / 60 }[timeUnit] ?? 0;
  const timeMinutes = value * factor;
  return Math.round((timeMinutes / (workingHoursPerDay * 60)) * wage * labourers * 100) / 100;
}

/** Research Mode only — Labour Cost log for a TrialPlot. Wage rate/hours default from the Trial. */
export default function TrialLabourCostEntry({ trialPlotId, trial, labour, onChanged }) {
  const { t } = useTranslation();
  const [draftRows, setDraftRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/trial-labour-costs/${deleteTarget._id}`);
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

  const isRowFilled = (r) => r.practice.trim() !== '' && r.timeValue !== '';
  const readyRows = draftRows.filter(isRowFilled);
  const hasWageRate = typeof trial?.wageRatePerDayRwf === 'number';

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const row of readyRows) {
        // eslint-disable-next-line no-await-in-loop
        await writeThrough({
          endpoint: `/trial-plots/${trialPlotId}/labour-costs`,
          method: 'POST',
          body: {
            date: row.date,
            practice: row.practice,
            costType: row.costType,
            numLabourers: Number(row.numLabourers),
            timeValue: Number(row.timeValue),
            timeUnit: row.timeUnit
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

  const total = labour.reduce((sum, l) => sum + (l.totalCostRwf || 0), 0);

  return (
    <div>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      {!hasWageRate && <p className="text-muted small">{t('trial.setWageRateOnTrial')}</p>}

      <Table size="sm" hover responsive>
        <thead>
          <tr>
            <th>{t('cost.date')}</th>
            <th>{t('trial.practice')}</th>
            <th>{t('cost.costClass')}</th>
            <th>{t('trial.numLabourers')}</th>
            <th>{t('trial.timeValue')}</th>
            <th>{t('trial.timeUnit')}</th>
            <th>{t('cost.totalCost')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {labour.map((l) => (
            <tr key={l._id}>
              <td>{formatDate(l.date)}</td>
              <td>{l.practice}</td>
              <td>{t(`cost.${l.costType}`)}</td>
              <td>{l.numLabourers}</td>
              <td>{l.timeValue}</td>
              <td>{t(`trial.timeUnit_${l.timeUnit}`)}</td>
              <td>{formatRWF(l.totalCostRwf)}</td>
              <td>
                <Button variant="link" size="sm" className="text-danger p-0" onClick={() => setDeleteTarget(l)}>
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
                  placeholder={t('trial.practice')}
                  value={row.practice}
                  onChange={(e) => updateDraft(row.localId, 'practice', e.target.value)}
                />
              </td>
              <td>
                <Form.Select size="sm" value={row.costType} onChange={(e) => updateDraft(row.localId, 'costType', e.target.value)}>
                  <option value="C_SD">{t('cost.C_SD')}</option>
                  <option value="C_SI">{t('cost.C_SI')}</option>
                </Form.Select>
              </td>
              <td>
                <Form.Control
                  size="sm"
                  type="number"
                  min={0}
                  value={row.numLabourers}
                  onChange={(e) => updateDraft(row.localId, 'numLabourers', e.target.value)}
                />
              </td>
              <td>
                <Form.Control
                  size="sm"
                  type="number"
                  min={0}
                  value={row.timeValue}
                  onChange={(e) => updateDraft(row.localId, 'timeValue', e.target.value)}
                />
              </td>
              <td>
                <Form.Select size="sm" value={row.timeUnit} onChange={(e) => updateDraft(row.localId, 'timeUnit', e.target.value)}>
                  <option value="min">{t('trial.timeUnit_min')}</option>
                  <option value="hr">{t('trial.timeUnit_hr')}</option>
                  <option value="sec">{t('trial.timeUnit_sec')}</option>
                </Form.Select>
              </td>
              <td className="align-middle">
                {formatRWF(
                  previewTotal({
                    timeValue: row.timeValue,
                    timeUnit: row.timeUnit,
                    numLabourers: row.numLabourers,
                    wageRatePerDayRwf: trial?.wageRatePerDayRwf,
                    workingHoursPerDay: trial?.workingHoursPerDay
                  })
                )}
              </td>
              <td className="align-middle">
                <Button variant="link" size="sm" className="text-danger p-0" onClick={() => removeDraft(row.localId)}>
                  ×
                </Button>
              </td>
            </tr>
          ))}

          <tr className="fw-bold table-light">
            <td colSpan={6}>{t('trial.subtotalLabourCosts')}</td>
            <td>{formatRWF(total)}</td>
            <td />
          </tr>
        </tbody>
      </Table>

      <div className="d-flex flex-wrap gap-2">
        <Button variant="outline-success" size="sm" onClick={addDraft}>
          + {t('common.add')}
        </Button>
        <Button variant="success" size="sm" onClick={save} disabled={saving || !hasWageRate || readyRows.length === 0}>
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
