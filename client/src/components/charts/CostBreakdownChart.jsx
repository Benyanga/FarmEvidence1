import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import './chartSetup';

/** @param {{cBase:number, cSys:number, cTime:number}} breakdown */
export default function CostBreakdownChart({ breakdown }) {
  if (!breakdown) return null;

  const data = {
    labels: ['Base Cost', 'System Adjustment', 'Time Adjustment'],
    datasets: [
      {
        data: [breakdown.cBase, Math.abs(breakdown.cSys), Math.abs(breakdown.cTime)],
        backgroundColor: ['#2e7d32', '#66bb6a', '#a5d6a7']
      }
    ]
  };

  return <Doughnut data={data} options={{ plugins: { legend: { position: 'bottom' } } }} />;
}
