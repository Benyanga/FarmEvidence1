import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import { writeThrough } from '../../services/offline.service';
import api from '../../services/api';
import ErrorAlert from '../../components/common/ErrorAlert';
import ConfirmModal from '../../components/common/ConfirmModal';
import { LABOR_UNITS } from '../../utils/constants';
import { formatRWF, formatDate } from '../../utils/formatters';
import { computeLaborRowTotal, nextLocalId } from '../../utils/costCalc';

function emptyRow() {
  return { localId: nextLocalId(), date: new Date().toISOString().slice(0, 10), activity: '', timeTaken: '', unit: 'days' };
}

export default function LaborEntry({ plotId, seasonId, season, labor, onChanged }) {
  const { t } = useTranslation();
  const [draftRows, setDraftRows] = useState([emptyRow()]);
  const [settings, setSettings] = useState({
    wageRatePerDay: season?.laborSettings?.wageRatePerDay ?? '',
    workingHoursPerDay: season?.laborSettings?.workingHoursPerDay ?? 8
  });
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/labor/${deleteTarget._id}`);
      setDeleteTarget(null);
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    }
  };

  useEffect(() => {
    setSettings({
      wageRatePerDay: season?.laborSettings?.wageRatePerDay ?? '',
      workingHoursPerDay: season?.laborSettings?.workingHoursPerDay ?? 8
    });
  }, [season]);

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    try {
      await api.put(`/seasons/${seasonId}`, {
        laborSettings: {
          wageRatePerDay: Number(settings.wageRatePerDay),
          workingHoursPerDay: Number(settings.workingHoursPerDay)
        }
      });
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const hasWageRate = typeof settings.wageRatePerDay === 'number' || settings.wageRatePerDay !== '';

  const updateDraft = (localId, field, value) => {
    setDraftRows((rows) => rows.map((r) => (r.localId === localId ? { ...r, [field]: value } : r)));
  };

  const removeDraft = (localId) => {
    setDraftRows((rows) => rows.filter((r) => r.localId !== localId));
  };

  const addDraft = () => setDraftRows((rows) => [...rows, emptyRow()]);

  const isRowFilled = (r) => r.activity.trim() !== '' && r.timeTaken !== '';
  const readyRows = draftRows.filter(isRowFilled);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const row of readyRows) {
        // eslint-disable-next-line no-await-in-loop
        await writeThrough({
          endpoint: `/plots/${plotId}/labor`,
          method: 'POST',
          body: { date: row.date, activity: row.activity, timeTaken: Number(row.timeTaken), unit: row.unit }
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

  const total = labor.reduce((sum, l) => sum + (l.laborCost || 0), 0);

  return (
    <div>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      <Form onSubmit={saveSettings} className="mb-3 border rounded p-3">
        <Row className="align-items-end">
          <Col xs={12} sm={5} md={3}>
            <Form.Group className="mb-2 mb-sm-0">
              <Form.Label>{t('cost.wageRatePerDay')}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                required
                value={settings.wageRatePerDay}
                onChange={(e) => setSettings((s) => ({ ...s, wageRatePerDay: e.target.value }))}
              />
            </Form.Group>
          </Col>
          <Col xs={12} sm={5} md={3}>
            <Form.Group className="mb-2 mb-sm-0">
              <Form.Label>{t('cost.workingHoursPerDay')}</Form.Label>
              <Form.Control
                type="number"
                min={1}
                required
                value={settings.workingHoursPerDay}
                onChange={(e) => setSettings((s) => ({ ...s, workingHoursPerDay: e.target.value }))}
              />
            </Form.Group>
          </Col>
          <Col xs={12} sm={2}>
            <Button type="submit" size="sm" variant="outline-success" disabled={savingSettings}>
              {savingSettings ? t('common.loading') : t('common.save')}
            </Button>
          </Col>
        </Row>
      </Form>

      {!hasWageRate && <p className="text-muted small">{t('cost.setWageRateFirst')}</p>}

      <Table size="sm" hover responsive>
        <thead>
          <tr>
            <th>{t('cost.date')}</th>
            <th>{t('cost.activity')}</th>
            <th>{t('cost.timeTaken')}</th>
            <th>{t('cost.unit')}</th>
            <th>{t('cost.wageRatePerDay')}</th>
            <th>{t('cost.totalCost')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {labor.map((l) => (
            <tr key={l._id}>
              <td>{formatDate(l.date)}</td>
              <td>{l.activity}</td>
              <td>{l.timeTaken}</td>
              <td>{t(`cost.unit_${l.unit}`)}</td>
              <td>{formatRWF(l.wageRatePerDay)}</td>
              <td>{formatRWF(l.laborCost)}</td>
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
                  placeholder={t('cost.activity')}
                  value={row.activity}
                  onChange={(e) => updateDraft(row.localId, 'activity', e.target.value)}
                />
              </td>
              <td>
                <Form.Control
                  size="sm"
                  type="number"
                  min={0}
                  value={row.timeTaken}
                  onChange={(e) => updateDraft(row.localId, 'timeTaken', e.target.value)}
                />
              </td>
              <td>
                <Form.Select size="sm" value={row.unit} onChange={(e) => updateDraft(row.localId, 'unit', e.target.value)}>
                  {LABOR_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {t(`cost.unit_${u}`)}
                    </option>
                  ))}
                </Form.Select>
              </td>
              <td className="align-middle">{formatRWF(Number(settings.wageRatePerDay) || null)}</td>
              <td className="align-middle">
                {formatRWF(
                  computeLaborRowTotal({
                    timeTaken: row.timeTaken,
                    unit: row.unit,
                    wageRatePerDay: settings.wageRatePerDay,
                    workingHoursPerDay: settings.workingHoursPerDay
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
