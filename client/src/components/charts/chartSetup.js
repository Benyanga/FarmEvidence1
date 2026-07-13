import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

export const PALETTE = {
  ca: '#2e7d32',
  cf: '#8d6e63',
  best: '#2e7d32',
  normal: '#f9a825',
  worst: '#c62828'
};
