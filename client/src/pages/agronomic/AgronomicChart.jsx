import React from 'react';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import '../../components/charts/chartSetup';
import { AGRONOMIC_INDICATORS } from '../../utils/constants';

export default function AgronomicChart({ agronomic }) {
  const { t } = useTranslation();
  if (!agronomic) return null;

  const labels = AGRONOMIC_INDICATORS.map(({ key }) => t(`agronomic.${key}`));
  const values = AGRONOMIC_INDICATORS.map(({ key }) => agronomic[key]?.value ?? 0);

  const data = {
    labels,
    datasets: [{ label: 'Current season', data: values, backgroundColor: '#2e7d32' }]
  };

  return <Bar data={data} options={{ responsive: true, plugins: { legend: { display: false } } }} />;
}
