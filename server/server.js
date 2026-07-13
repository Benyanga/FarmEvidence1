require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cron = require('node-cron');

const { connectDB } = require('./config/db');
const { globalLimiter } = require('./middleware/rateLimiters');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { runTimeBasedSweep } = require('./services/timeNotifications.service');

const authRoutes = require('./routes/auth.routes');
const setupRoutes = require('./routes/setup.routes');
const seasonRoutes = require('./routes/season.routes');
const trialRoutes = require('./routes/trial.routes');
const plotRoutes = require('./routes/plot.routes');
const costRoutes = require('./routes/cost.routes');
const yieldRoutes = require('./routes/yield.routes');
const agronomicRoutes = require('./routes/agronomic.routes');
const computeRoutes = require('./routes/compute.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');
const syncRoutes = require('./routes/sync.routes');
const chartRoutes = require('./routes/chart.routes');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', globalLimiter);

app.get('/', (req, res) => {
  res.json({
    name: 'FarmEvidence API',
    status: 'ok',
    health: '/api/health',
    docs: 'See docs/API_SPEC.md for available endpoints (all mounted under /api).'
  });
});

app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use('/api', authRoutes);
app.use('/api', setupRoutes);
app.use('/api', seasonRoutes);
app.use('/api', trialRoutes);
app.use('/api', plotRoutes);
app.use('/api', costRoutes);
app.use('/api', yieldRoutes);
app.use('/api', agronomicRoutes);
app.use('/api', computeRoutes);
app.use('/api', notificationRoutes);
app.use('/api', reportRoutes);
app.use('/api', syncRoutes);
app.use('/api', chartRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[server] FarmEvidence API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  // Daily time-based notification sweep (season reminders, data-entry deadlines).
  cron.schedule('0 6 * * *', () => {
    runTimeBasedSweep().catch((err) => console.error('[cron] time-based sweep failed', err));
  });
}

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});

module.exports = app;
