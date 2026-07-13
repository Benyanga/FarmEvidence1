import React from 'react';
import { useTranslation } from 'react-i18next';
import Table from 'react-bootstrap/Table';
import { formatRWF } from '../../utils/formatters';

/** §6.2 Cost Structure — per-treatment component breakdown + C_SD/C_SI roll-up. */
export default function CostStructureTable({ costStructure }) {
  const { t } = useTranslation();
  const labels = Object.keys(costStructure || {});
  if (labels.length === 0) return <p className="text-muted">{t('common.noData')}</p>;

  const componentNames = new Set();
  labels.forEach((l) => Object.keys(costStructure[l].components || {}).forEach((name) => componentNames.add(name)));

  return (
    <>
      <h6>{t('research.costStructure')}</h6>
      <Table hover responsive size="sm" className="mb-4">
        <thead>
          <tr>
            <th>{t('research.item')}</th>
            {labels.map((l) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...componentNames].map((name) => (
            <tr key={name}>
              <td>{name}</td>
              {labels.map((l) => {
                const c = costStructure[l].components?.[name];
                return (
                  <td key={l}>
                    {c ? `${formatRWF(c.amount)} (${c.pctOfTotal ?? '—'}%)` : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="fw-bold table-light">
            <td>{t('common.total')}</td>
            {labels.map((l) => (
              <td key={l}>{formatRWF(costStructure[l].total)}</td>
            ))}
          </tr>
        </tbody>
      </Table>

      <h6>{t('cost.costClass')}</h6>
      <Table hover responsive size="sm">
        <thead>
          <tr>
            <th>{t('cost.costClass')}</th>
            {labels.map((l) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {['C_SD', 'C_SI'].map((cls) => (
            <tr key={cls}>
              <td>{t(`cost.${cls}`)}</td>
              {labels.map((l) => {
                const entry = costStructure[l].csdCsi?.[cls];
                return <td key={l}>{entry ? `${formatRWF(entry.amount)} (${entry.pctOfTotal ?? '—'}%)` : '—'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
