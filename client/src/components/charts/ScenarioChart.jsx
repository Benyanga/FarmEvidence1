import React from 'react';
import { Bar } from 'react-chartjs-2';
import './chartSetup';
import { PALETTE } from './chartSetup';

/** @param {{best:{profit:number}, normal:{profit:number}, worst:{profit:number}}} scenarios */
export default function ScenarioChart({ scenarios }) {
  if (!scenarios) return null;

  const data = {
    labels: ['Worst', 'Normal', 'Best'],
    datasets: [
      {
        label: 'Profit (RWF)',
        data: [scenarios.worst.profit, scenarios.normal.profit, scenarios.best.profit],
        backgroundColor: [PALETTE.worst, PALETTE.normal, PALETTE.best]
      }
    ]
  };

  return <Bar data={data} options={{ responsive: true, plugins: { legend: { display: false } } }} />;
}
