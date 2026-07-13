import React from 'react';
import { Line } from 'react-chartjs-2';
import './chartSetup';

/** @param {Array<{season:number, value:number}>} timeSeries */
export default function TrendChart({ timeSeries = [], label = 'Value' }) {
  const data = {
    labels: timeSeries.map((p) => `S${p.season}`),
    datasets: [
      {
        label,
        data: timeSeries.map((p) => p.value),
        borderColor: '#2e7d32',
        backgroundColor: 'rgba(46,125,50,0.15)',
        fill: true,
        tension: 0.25
      }
    ]
  };

  return <Line data={data} options={{ responsive: true, plugins: { legend: { display: false } } }} />;
}
