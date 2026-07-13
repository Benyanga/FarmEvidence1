import React from 'react';
import { Line } from 'react-chartjs-2';
import './chartSetup';
import { PALETTE } from './chartSetup';

/** @param {Array<{season:number, profitCA:number, profitCF:number}>} series */
export default function ProfitChart({ series = [] }) {
  const data = {
    labels: series.map((s) => `S${s.season}`),
    datasets: [
      {
        label: 'CA Profit',
        data: series.map((s) => s.profitCA),
        borderColor: PALETTE.ca,
        backgroundColor: PALETTE.ca,
        tension: 0.25
      },
      {
        label: 'CF Profit',
        data: series.map((s) => s.profitCF),
        borderColor: PALETTE.cf,
        backgroundColor: PALETTE.cf,
        tension: 0.25
      }
    ]
  };

  return <Line data={data} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />;
}
