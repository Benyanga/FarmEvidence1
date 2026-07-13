import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import useSync from '../../hooks/useSync';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import { renderChartImage } from '../../utils/charts';
import { formatRWF, formatNumber, seasonLabel } from '../../utils/formatters';
import { TREATMENT } from '../../utils/chartTheme';
import './DashboardShared.css';
import './ResearcherDashboard.css';

const CA_COLOR = TREATMENT.CA.solid;
const CF_COLOR = TREATMENT.CF.solid;

function buildEntities(trials) {
  const conforming = trials.filter((t) => t.isCACF);
  const bySetup = new Map();
  for (const item of conforming) {
    const key = item.setup?._id;
    if (!key) continue;
    if (!bySetup.has(key)) bySetup.set(key, { setup: item.setup, trials: [] });
    bySetup.get(key).trials.push(item);
  }
  const entities = [...bySetup.values()].map((e) => ({
    ...e,
    trials: [...e.trials].sort((a, b) => {
      if ((a.season?.year || 0) !== (b.season?.year || 0)) return (b.season?.year || 0) - (a.season?.year || 0);
      return String(b.season?.seasonCode || '').localeCompare(String(a.season?.seasonCode || ''));
    })
  }));
  entities.sort((a, b) => a.setup.name.localeCompare(b.setup.name));
  return entities;
}

function pickDefaultEntity(entities) {
  if (entities.length === 0) return null;
  let best = null;
  for (const e of entities) {
    const latest = Math.max(...e.trials.map((t) => new Date(t.trial.updatedAt).getTime()));
    if (!best || latest > best.latest) best = { entity: e, latest };
  }
  return best.entity;
}

function SyncPill({ isOnline, syncing, pendingCount }) {
  const cls = !isOnline ? 'offline' : syncing ? 'syncing' : 'online';
  const label = !isOnline ? 'Offline' : syncing ? 'Syncing' : pendingCount > 0 ? 'Pending sync' : 'Synced';
  return (
    <span className={`sync-pill ${cls}`}>
      <span className="sync-dot" />
      {label}
    </span>
  );
}

export default function ResearcherDashboard() {
  const { t } = useTranslation();
  const { isOnline, syncing, pendingCount } = useSync();

  const [trials, setTrials] = useState(null);
  const [selectedSetupId, setSelectedSetupId] = useState(null);
  const [selectedTrialId, setSelectedTrialId] = useState(null);
  const [entityDashboards, setEntityDashboards] = useState({});
  const [chartImages, setChartImages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingEntity, setLoadingEntity] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/trials');
        if (cancelled) return;
        setTrials(data.trials);
        const entities = buildEntities(data.trials);
        const defaultEntity = pickDefaultEntity(entities);
        if (defaultEntity) {
          setSelectedSetupId(defaultEntity.setup._id);
          setSelectedTrialId(defaultEntity.trials[0].trial._id);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || { message: err.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entities = useMemo(() => (trials ? buildEntities(trials) : []), [trials]);
  const selectedEntity = useMemo(() => entities.find((e) => e.setup._id === selectedSetupId) || null, [entities, selectedSetupId]);

  // Fetch dashboard data for every trial (season) under the selected entity —
  // the profit-trend chart needs all of them, not just the active season.
  useEffect(() => {
    if (!selectedEntity) return;
    let cancelled = false;
    (async () => {
      setLoadingEntity(true);
      try {
        const results = await Promise.all(
          selectedEntity.trials.map((item) => api.get(`/trials/${item.trial._id}/dashboard`).then((res) => [item.trial._id, res.data]))
        );
        if (cancelled) return;
        setEntityDashboards(Object.fromEntries(results));
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || { message: err.message });
      } finally {
        if (!cancelled) setLoadingEntity(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEntity]);

  const dashboardData = selectedTrialId ? entityDashboards[selectedTrialId] : null;

  // Render the three season-charts once the active season's data is in.
  useEffect(() => {
    if (!dashboardData?.comparison || !selectedEntity) {
      setChartImages(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [a, b] = dashboardData.comparison.treatmentLabels;
        const profitRow = dashboardData.comparison.rows.find((r) => r.metric === 'Profit');

        const profitChart = renderChartImage({
          type: 'bar',
          labels: ['Profit (RWF/plot)'],
          series: [
            { name: a, values: [profitRow.values[a]], color: CA_COLOR },
            { name: b, values: [profitRow.values[b]], color: CF_COLOR }
          ],
          title: 'Profit by Treatment'
        });

        const cb = dashboardData.costBreakdown;
        const costChart = cb
          ? renderChartImage({
              type: 'bar',
              stacked: true,
              labels: [a, b],
              series: Object.keys({ ...cb[a]?.components, ...cb[b]?.components }).map((name) => ({
                name,
                values: [cb[a]?.components?.[name]?.amount ?? 0, cb[b]?.components?.[name]?.amount ?? 0]
              })),
              title: 'Cost Breakdown by Treatment'
            })
          : Promise.resolve(null);

        const trendEntries = selectedEntity.trials
          .map((item) => ({ item, dash: entityDashboards[item.trial._id] }))
          .filter((x) => x.dash?.comparison)
          .reverse(); // chronological, oldest first
        const trendChart =
          trendEntries.length > 1
            ? renderChartImage({
                type: 'line',
                labels: trendEntries.map((x) => seasonLabel(x.item.season)),
                series: [a, b].map((label, i) => ({
                  name: label,
                  values: trendEntries.map((x) => x.dash.comparison.rows.find((r) => r.metric === 'Profit')?.values?.[label] ?? null),
                  color: i === 0 ? CA_COLOR : CF_COLOR
                })),
                title: 'Profit Trend Across Seasons'
              })
            : Promise.resolve(null);

        const [profit, cost, trend] = await Promise.all([profitChart, costChart, trendChart]);
        if (!cancelled) setChartImages({ profit, cost, trend });
      } catch (err) {
        console.error('[ResearcherDashboard] chart render failed', err);
        if (!cancelled) setChartImages(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardData, selectedEntity, entityDashboards]);

  if (loading) return <LoadingSpinner />;

  if (entities.length === 0) {
    return (
      <div className="rdash">
        <ErrorAlert error={error} onClose={() => setError(null)} />
        <div className="empty-page">
          <p className="mb-3">No Conservation Agriculture vs Conventional Farming trials yet.</p>
          <Link to="/setups/new" className="btn btn-dark btn-sm">
            + {t('dashboard.createSetup')}
          </Link>
        </div>
      </div>
    );
  }

  const activeItem = selectedEntity?.trials.find((x) => x.trial._id === selectedTrialId) || selectedEntity?.trials[0];
  const trial = activeItem?.trial;
  const season = activeItem?.season;

  const metaParts = trial
    ? [
        seasonLabel(season),
        trial.crop,
        'CA vs CF',
        trial.plotSizeM2 ? `${trial.plotSizeM2} m² per plot` : null,
        trial.numReplicates ? `${trial.numReplicates} replications` : null,
        dashboardData ? `${dashboardData.plotStatus.length} plots` : null
      ].filter(Boolean)
    : [];

  return (
    <div className="rdash">
      <ErrorAlert error={error} onClose={() => setError(null)} />

      <div className="dash-header">
        <div className="tb-left">
          <div className="tb-name">{selectedEntity?.setup.name}</div>
          <div className="tb-meta">{metaParts.join(' · ')}</div>
        </div>
        <div className="tb-right">
          <SyncPill isOnline={isOnline} syncing={syncing} pendingCount={pendingCount} />
          <Link to="/setups/new" className="btn btn-dark btn-sm">
            + {t('dashboard.createSetup')}
          </Link>
        </div>
      </div>

      <div className="entity-tabs">
        {entities.map((e) => (
          <div
            key={e.setup._id}
            className={`stab${e.setup._id === selectedSetupId ? ' active' : ''}`}
            onClick={() => {
              setSelectedSetupId(e.setup._id);
              setSelectedTrialId(e.trials[0].trial._id);
            }}
          >
            {e.setup.name}
          </div>
        ))}
      </div>

      {selectedEntity && (
        <div className="season-tabs">
          {selectedEntity.trials.map((item) => (
            <div
              key={item.trial._id}
              className={`stab${item.trial._id === selectedTrialId ? ' active' : ''}`}
              onClick={() => setSelectedTrialId(item.trial._id)}
            >
              {seasonLabel(item.season)}
            </div>
          ))}
        </div>
      )}

      {loadingEntity || !dashboardData ? (
        <LoadingSpinner />
      ) : (
        <>
          <StatusRow statusRow={dashboardData.statusRow} statisticalResult={dashboardData.statisticalResult} />
          <ComparisonCard dashboardData={dashboardData} seasonLabelText={seasonLabel(season)} />

          <div className="bottom-grid">
            <StatCard statisticalResult={dashboardData.statisticalResult} />
            <PlotsCard plotStatus={dashboardData.plotStatus} />
            <AlertsCard alerts={dashboardData.alerts} />
          </div>

          {chartImages && (
            <>
              <div className="chart-row">
                {chartImages.profit && (
                  <div className="chart-card">
                    <div className="chart-card-title">Profit by Treatment</div>
                    <img src={chartImages.profit} alt="Profit by treatment" />
                    {dashboardData.comparison?.deltaSentence && <div className="chart-caption">{dashboardData.comparison.deltaSentence}.</div>}
                  </div>
                )}
                {chartImages.cost && (
                  <div className="chart-card">
                    <div className="chart-card-title">Cost Breakdown by Treatment</div>
                    <img src={chartImages.cost} alt="Cost breakdown by treatment" />
                    <div className="chart-caption">Labour and input costs recorded this season, by treatment.</div>
                  </div>
                )}
                {chartImages.trend && (
                  <div className="chart-card">
                    <div className="chart-card-title">Profit Trend Across Seasons</div>
                    <img src={chartImages.trend} alt="Profit trend across seasons" />
                    <div className="chart-caption">Profit per plot across every recorded season at this site.</div>
                  </div>
                )}
              </div>
              <div className="view-all-row">
                <Link to={`/trials/${selectedTrialId}/analysis`} className="view-all-link">
                  View all charts →
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatusRow({ statusRow, statisticalResult }) {
  const { recorded, expected, computed, pendingCount } = statusRow;
  const sig = statisticalResult?.canCompute ? statisticalResult : null;

  return (
    <div className="status-row">
      <div className="stat-mini">
        <div className="sm-icon" style={{ background: computed ? '#F0FDF4' : '#EFF4FA' }}>
          <span style={{ color: computed ? '#166534' : '#185FA5' }}>▤</span>
        </div>
        <div className="sm-text">
          <div className="sm-val">
            {recorded} / {expected}
          </div>
          <div className="sm-lbl">Plots recorded</div>
        </div>
      </div>
      <div className="stat-mini">
        <div className="sm-icon" style={{ background: computed ? '#F0FDF4' : '#FFFBEB' }}>
          <span style={{ color: computed ? '#166534' : '#92400E' }}>✓</span>
        </div>
        <div className="sm-text">
          <div className="sm-val">{computed ? 'Computed' : `Pending — ${pendingCount} plots`}</div>
          <div className="sm-lbl">{computed ? 'All plots analysed' : 'Awaiting data entry'}</div>
        </div>
      </div>
      <div className="stat-mini">
        <div className="sm-icon" style={{ background: '#FAEEDA' }}>
          <span style={{ color: '#92400E' }}>⚗</span>
        </div>
        <div className="sm-text">
          <div className="sm-val">2 treatments</div>
          <div className="sm-lbl">CA · CF</div>
        </div>
      </div>
      <div className="stat-mini">
        <div className="sm-icon" style={{ background: sig?.significant ? '#EAF3DE' : '#F8FAFC' }}>
          <span style={{ color: sig?.significant ? '#3B6D11' : '#9CA3AF' }}>△</span>
        </div>
        <div className="sm-text">
          <div className="sm-val">{sig ? `p = ${sig.pValue}` : '—'}</div>
          <div className="sm-lbl">{sig ? (sig.significant ? 'Significant difference' : 'No significant difference') : 'Not yet computed'}</div>
        </div>
      </div>
    </div>
  );
}

function ComparisonCard({ dashboardData, seasonLabelText }) {
  const { comparison, statusRow } = dashboardData;
  if (!comparison) {
    return (
      <div className="comp-card">
        <div className="cc-head">
          <div className="cc-title">Treatment Comparison — {seasonLabelText}</div>
        </div>
        <div className="empty-comparison">
          Awaiting data for {statusRow.pendingCount} of {statusRow.expected} plot(s) before treatment comparison can be computed.
        </div>
      </div>
    );
  }

  const [a, b] = comparison.treatmentLabels;
  const formatValue = (metric, unit, v) => {
    if (typeof v !== 'number') return '—';
    if (unit === 'RWF') return formatRWF(v);
    if (unit === '%') return `${formatNumber(v, 1)}%`;
    if (unit === 'kg') return `${formatNumber(v, 0)} kg`;
    return formatNumber(v, 2);
  };

  return (
    <div className="comp-card">
      <div className="cc-head">
        <div className="cc-title">Treatment Comparison — {seasonLabelText}</div>
        <div className="cc-sub">Mean values across replications</div>
      </div>
      <table className="comp-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th className="th-ca">{a}</th>
            <th className="th-cf">{b}</th>
            <th>Difference</th>
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.metric}>
              <td>{row.metric}</td>
              <td className={row.best === a ? 'best' : ''}>{formatValue(row.metric, row.unit, row.values[a])}</td>
              <td className={row.best === b ? 'best' : ''}>{formatValue(row.metric, row.unit, row.values[b])}</td>
              <td>
                {row.best && (
                  <span className={`pill-sm ${row.best === a ? 'ps-g' : 'ps-a'}`}>
                    {row.best} {row.unit === '%' ? `+${formatNumber(row.delta, 1)}%` : formatValue(row.metric, row.unit, row.delta)}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {comparison.deltaSentence && (
            <tr className="delta-row">
              <td>Season summary</td>
              <td colSpan={2} className="delta-pos" style={{ textAlign: 'center' }}>
                {comparison.deltaSentence}
              </td>
              <td />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ statisticalResult }) {
  if (!statisticalResult || !statisticalResult.canCompute) {
    return (
      <div className="sig-card">
        <div className="sc-head">Statistical Result</div>
        <div className="empty-comparison">Not enough recorded data yet to run a significance test.</div>
      </div>
    );
  }
  const { significant, pValue, d, magnitude, replications, labels } = statisticalResult;
  return (
    <div className="sig-card">
      <div className="sc-head">Statistical Result</div>
      <div className={`sig-banner ${significant ? 'sb-green' : 'sb-amber'}`}>
        <div className="sig-title">{significant ? 'Meaningful difference found' : 'No significant difference yet'}</div>
        <div className="sig-sub">
          {labels?.[0]} and {labels?.[1]} profit {significant ? 'are' : 'are not'} significantly different (p = {pValue})
        </div>
      </div>
      <div className="stat-row">
        <div className="stat-item">
          <div className="si-val">{pValue}</div>
          <div className="si-lbl">p-value</div>
        </div>
        <div className="stat-item">
          <div className="si-val">{d}</div>
          <div className="si-lbl">Effect size</div>
        </div>
        <div className="stat-item">
          <div className="si-val">{replications}</div>
          <div className="si-lbl">Replications</div>
        </div>
        <div className="stat-item">
          <div className="si-val">{magnitude}</div>
          <div className="si-lbl">Effect magnitude</div>
        </div>
      </div>
    </div>
  );
}

function PlotsCard({ plotStatus }) {
  const statusText = { complete: 'Complete', partial: 'Partial', not_started: 'Not started' };
  return (
    <div className="plots-card">
      <div className="pc-head">Plot Recording Status</div>
      <div className="plot-grid">
        {plotStatus.map((p) => (
          <div className="plot-item" key={p.plotId}>
            <div className={`pi-badge ${p.status}`} />
            <div className="pi-label">{p.plotCode}</div>
            <div className="pi-status">{statusText[p.status]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsCard({ alerts }) {
  return (
    <div className="alerts-card">
      <div className="ac-title">Season Insights</div>
      {alerts.map((a, i) => (
        <div className={`alert-item ai-${a.severity}`} key={i}>
          {a.text}
        </div>
      ))}
    </div>
  );
}
