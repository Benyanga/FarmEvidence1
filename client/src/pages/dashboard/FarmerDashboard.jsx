import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import useSync from '../../hooks/useSync';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import { renderChartImage } from '../../utils/charts';
import { formatRWF, formatNumber, seasonLabel } from '../../utils/formatters';
import { TREATMENT, categoricalColor } from '../../utils/chartTheme';
import './DashboardShared.css';
import './FarmerDashboard.css';

const TREATMENT_COLOR = { CA: TREATMENT.CA.solid, CF: TREATMENT.CF.solid };
const ESTABLISHED_AT_SEASON = 7;
const HISTORY_CHART_THRESHOLD = 4;

function buildEntities(seasons) {
  const bySetup = new Map();
  for (const item of seasons) {
    const key = item.setup?._id;
    if (!key) continue;
    if (!bySetup.has(key)) bySetup.set(key, { setup: item.setup, seasons: [] });
    bySetup.get(key).seasons.push(item);
  }
  const entities = [...bySetup.values()].map((e) => ({
    ...e,
    seasons: [...e.seasons].sort((a, b) => (b.season.seasonNumber || 0) - (a.season.seasonNumber || 0))
  }));
  entities.sort((a, b) => a.setup.name.localeCompare(b.setup.name));
  return entities;
}

function pickDefaultEntity(entities) {
  if (entities.length === 0) return null;
  let best = null;
  for (const e of entities) {
    const latest = Math.max(...e.seasons.map((s) => new Date(s.season.updatedAt).getTime()));
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

export default function FarmerDashboard() {
  const { t } = useTranslation();
  const { isOnline, syncing, pendingCount } = useSync();

  const [seasons, setSeasons] = useState(null);
  const [selectedSetupId, setSelectedSetupId] = useState(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [historyChart, setHistoryChart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDash, setLoadingDash] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/seasons');
        if (cancelled) return;
        setSeasons(data.seasons);
        const entities = buildEntities(data.seasons);
        const defaultEntity = pickDefaultEntity(entities);
        if (defaultEntity) {
          setSelectedSetupId(defaultEntity.setup._id);
          setSelectedSeasonId(defaultEntity.seasons[0].season._id);
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

  const entities = useMemo(() => (seasons ? buildEntities(seasons) : []), [seasons]);
  const selectedEntity = useMemo(() => entities.find((e) => e.setup._id === selectedSetupId) || null, [entities, selectedSetupId]);

  useEffect(() => {
    if (!selectedSeasonId) return;
    let cancelled = false;
    (async () => {
      setLoadingDash(true);
      try {
        const { data } = await api.get(`/seasons/${selectedSeasonId}/dashboard`);
        if (!cancelled) setDashboardData(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || { message: err.message });
      } finally {
        if (!cancelled) setLoadingDash(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSeasonId]);

  useEffect(() => {
    if (!dashboardData || dashboardData.seasonHistory.length < HISTORY_CHART_THRESHOLD) {
      setHistoryChart(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const ordered = [...dashboardData.seasonHistory].sort((a, b) => a.season - b.season);
      const image = await renderChartImage({
        type: 'line',
        labels: ordered.map((s) => `S${s.season}`),
        series: [{ name: 'Profit', values: ordered.map((s) => s.profit), color: TREATMENT_COLOR.CA }],
        title: 'Season History — Profit'
      }).catch(() => null);
      if (!cancelled) setHistoryChart(image);
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardData]);

  if (loading) return <LoadingSpinner />;

  if (entities.length === 0) {
    return (
      <div className="fdash">
        <ErrorAlert error={error} onClose={() => setError(null)} />
        <div className="empty-page">
          <p className="mb-3">No farms recorded yet.</p>
          <Link to="/setups/new" className="btn btn-dark btn-sm">
            + {t('dashboard.createFarm')}
          </Link>
        </div>
      </div>
    );
  }

  const activeItem = selectedEntity?.seasons.find((x) => x.season._id === selectedSeasonId) || selectedEntity?.seasons[0];
  const season = activeItem?.season;
  const plot = dashboardData?.plot;
  // plot.plotArea is stored in hectares (see Plot back-fill in season.controller.js), not m² —
  // the extrapolation factor to reach 1 ha is therefore 1/plotArea, not 10000/plotArea.
  const yieldMultiplier = plot?.plotArea ? 1 / plot.plotArea : null;

  const metaParts = season
    ? [
        seasonLabel(season),
        season.cropType,
        season.farmingSystem,
        plot?.plotArea ? `${formatNumber(plot.plotArea, 2)} ha` : null,
        yieldMultiplier ? `×${formatNumber(yieldMultiplier, 1)}` : null
      ].filter(Boolean)
    : [];

  return (
    <div className="fdash">
      <ErrorAlert error={error} onClose={() => setError(null)} />

      <div className="dash-header">
        <div className="tb-left">
          <div className="tb-name">{selectedEntity?.setup.name}</div>
          <div className="tb-meta">{metaParts.join(' · ')}</div>
        </div>
        <div className="tb-right">
          <SyncPill isOnline={isOnline} syncing={syncing} pendingCount={pendingCount} />
          <Link to="/setups/new" className="btn btn-dark btn-sm">
            + {t('dashboard.createFarm')}
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
              setSelectedSeasonId(e.seasons[0].season._id);
            }}
          >
            {e.setup.name}
          </div>
        ))}
      </div>

      {selectedEntity && (
        <div className="season-tabs">
          {selectedEntity.seasons.map((item) => (
            <div
              key={item.season._id}
              className={`stab ${item.season.farmingSystem === 'CA' ? 'ca-tag' : 'cf-tag'}${item.season._id === selectedSeasonId ? ' active' : ''}`}
              onClick={() => setSelectedSeasonId(item.season._id)}
            >
              {seasonLabel(item.season)}
            </div>
          ))}
        </div>
      )}

      {loadingDash || !dashboardData ? (
        <LoadingSpinner />
      ) : (
        <>
          <PhaseCard season={season} phase={dashboardData.phase} />
          <KpiGrid plot={plot} priorPlot={dashboardData.priorPlot} />
          <AdoptionGapCard adoptionGap={dashboardData.adoptionGap} />

          <div className="three-col">
            <CostBreakdownCard costBreakdown={dashboardData.costBreakdown} />
            <SeasonHistoryCard seasonHistory={dashboardData.seasonHistory} historyChart={historyChart} />
            <SoilHealthCard soilHealth={dashboardData.soilHealth} />
          </div>

          <div className="two-col">
            <AlertsCard alerts={dashboardData.alerts} />
            <QuickActionsCard season={season} setupId={selectedEntity?.setup._id} gates={dashboardData.gates} />
          </div>
        </>
      )}
    </div>
  );
}

function PhaseCard({ season, phase }) {
  if (!phase) {
    return (
      <div className="phase-card neutral">
        <div className="phase-badge b-n">Conventional</div>
        <div className="phase-text">
          This farm is currently recording under Conventional Farming. Switch to Conservation Agriculture in a future season to begin tracking transition
          phase and adoption gap.
        </div>
        <div className="phase-season">{seasonLabel(season)}</div>
      </div>
    );
  }
  const badge = phase.established ? 'Established' : 'Transition';
  const text = phase.established
    ? `Season ${phase.seasonNumber} of CA on this farm. Efficiency gains from residue and labour savings are now fully realised.`
    : `Season ${phase.seasonNumber} of CA on this farm. Costs are adjusting — efficiency gains build from season ${ESTABLISHED_AT_SEASON} onwards.`;
  return (
    <div className="phase-card">
      <div className="phase-badge">{badge}</div>
      <div className="phase-text">{text}</div>
      <div className="phase-season">{seasonLabel(season)}</div>
    </div>
  );
}

function trendFor(current, prior, higherIsBetter) {
  if (typeof current !== 'number' || typeof prior !== 'number') return null;
  const delta = current - prior;
  const flat = delta === 0;
  const favourable = higherIsBetter ? delta > 0 : delta < 0;
  return { delta, flat, favourable, arrow: flat ? '→' : delta > 0 ? '↑' : '↓' };
}

function KpiCard({ label, unit, current, prior, higherIsBetter, extras, formatVal }) {
  const trend = trendFor(current, prior, higherIsBetter);
  const badge = !trend ? { cls: 'b-n', text: 'New' } : trend.flat ? { cls: 'b-a', text: 'Stable' } : trend.favourable ? { cls: 'b-g', text: 'Improving' } : { cls: 'b-r', text: 'Declining' };
  const barPct = typeof current === 'number' ? Math.max(6, Math.min(100, Math.round((Math.abs(current) / (Math.abs(current) + Math.abs(prior || current || 1))) * 130))) : 6;
  return (
    <div className="kpi">
      <div className="kpi-lbl">{label}</div>
      <div className={`badge ${badge.cls}`}>{badge.text}</div>
      <div className={`kpi-val ${trend ? (trend.favourable ? 'vg' : trend.flat ? 'va' : 'vr') : 'vn'}`}>{formatVal(current)}</div>
      <div className="kpi-unit">{unit}</div>
      <div className="bar">
        <div className="bar-f" style={{ width: `${barPct}%`, background: trend && trend.favourable === false ? '#F59E0B' : '#22C55E' }} />
      </div>
      <div className="kpi-row">
        <div className="ks">
          <div className="ksv">{extras[0][1]}</div>
          <div className="ksl">{extras[0][0]}</div>
        </div>
        <div className="ks">
          <div className="ksv">{extras[1][1]}</div>
          <div className="ksl">{extras[1][0]}</div>
        </div>
      </div>
      {trend ? (
        <div className={`trend ${trend.favourable ? 'tg' : trend.flat ? 'ta' : 'tr'}`}>
          {trend.arrow} {formatVal(Math.abs(trend.delta))} vs last season
        </div>
      ) : (
        <div className="trend va">No prior season recorded yet</div>
      )}
    </div>
  );
}

function KpiGrid({ plot, priorPlot }) {
  const c = plot?.computed || {};
  const p = priorPlot?.computed || {};
  return (
    <div className="kpi-grid">
      <KpiCard
        label="Profit"
        unit="RWF per plot"
        current={c.profit}
        prior={p.profit}
        higherIsBetter
        extras={[
          ['Revenue', formatRWF(plot?.revenue)],
          ['Cost', formatRWF(c.cSystem)]
        ]}
        formatVal={(v) => formatRWF(v)}
      />
      <KpiCard
        label="Benefit Cost Ratio"
        unit="Revenue / cost"
        current={c.bcr}
        prior={p.bcr}
        higherIsBetter
        extras={[
          ['Revenue', formatRWF(plot?.revenue)],
          ['Cost', formatRWF(c.cSystem)]
        ]}
        formatVal={(v) => (typeof v === 'number' ? v.toFixed(2) : '—')}
      />
      <KpiCard
        label="Return on Investment"
        unit="Profit as share of cost"
        current={c.roi}
        prior={p.roi}
        higherIsBetter
        extras={[
          ['This season', typeof c.roi === 'number' ? `${formatNumber(c.roi, 1)}%` : '—'],
          ['Last season', typeof p.roi === 'number' ? `${formatNumber(p.roi, 1)}%` : '—']
        ]}
        formatVal={(v) => (typeof v === 'number' ? `${formatNumber(v, 1)}%` : '—')}
      />
      <KpiCard
        label="Cost per Kilogram"
        unit="RWF per kg"
        current={c.costPerKg}
        prior={p.costPerKg}
        higherIsBetter={false}
        extras={[
          ['This season', typeof c.costPerKg === 'number' ? `${formatNumber(c.costPerKg, 0)} RWF` : '—'],
          ['Last season', typeof p.costPerKg === 'number' ? `${formatNumber(p.costPerKg, 0)} RWF` : '—']
        ]}
        formatVal={(v) => (typeof v === 'number' ? `${formatNumber(v, 0)} RWF` : '—')}
      />
    </div>
  );
}

function AdoptionGapCard({ adoptionGap }) {
  if (!adoptionGap) return null;
  const narrowed = adoptionGap.priorValue != null ? adoptionGap.priorValue - adoptionGap.value : null;
  return (
    <div className="ac-card">
      <div>
        <div className="ac-label">Adoption gap this season</div>
        <div className="ac-val">
          {formatNumber(adoptionGap.value, 0)} <span style={{ fontSize: 14, color: '#9CA3AF' }}>RWF</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div className="ac-text">
          CA is {formatNumber(adoptionGap.value, 0)} RWF behind the farm's own conventional baseline this season. This gap is expected during the transition
          phase — it narrows as soil and labour efficiency compounds.
        </div>
        {narrowed != null && (
          <div className="ac-trend">
            {narrowed >= 0 ? '↓' : '↑'} Gap {narrowed >= 0 ? 'narrowed' : 'widened'} by {formatNumber(Math.abs(narrowed), 0)} RWF since last season
          </div>
        )}
      </div>
      <div className="mini-grid" style={{ gridTemplateColumns: '1fr 1fr', minWidth: 180 }}>
        <div className="mini">
          <div className="mini-val">{formatNumber(adoptionGap.value, 0)}</div>
          <div className="mini-lbl">This season</div>
        </div>
        <div className="mini">
          <div className="mini-val">{adoptionGap.priorValue != null ? formatNumber(adoptionGap.priorValue, 0) : '—'}</div>
          <div className="mini-lbl">Last season</div>
        </div>
      </div>
    </div>
  );
}

function CostBreakdownCard({ costBreakdown }) {
  const items = Object.entries(costBreakdown?.items || {}).sort((a, b) => b[1] - a[1]);
  const total = items.reduce((s, [, v]) => s + v, 0);
  if (items.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Cost breakdown this season</div>
        <div className="muted-note">No costs recorded this season.</div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-title">Cost breakdown this season</div>
      {items.map(([label, value], i) => {
        const pct = total ? Math.round((value / total) * 100) : 0;
        return (
          <div key={label}>
            <div className="cost-row">
              <span>{label}</span>
              <span style={{ fontWeight: 600 }}>{formatNumber(value, 0)}</span>
            </div>
            <div className="cost-bar-track">
              <div className="cost-bar-fill" style={{ width: `${pct}%`, background: categoricalColor(i) }} />
            </div>
          </div>
        );
      })}
      <div className="cost-total-row">
        <span style={{ color: '#6B7280' }}>Total costs</span>
        <span style={{ color: '#1E2D40' }}>{formatNumber(total, 0)} RWF</span>
      </div>
    </div>
  );
}

function SeasonHistoryCard({ seasonHistory, historyChart }) {
  if (seasonHistory.length >= HISTORY_CHART_THRESHOLD) {
    return (
      <div className="card">
        <div className="card-title">Season history — profit ({seasonHistory.length} seasons)</div>
        {historyChart ? <img src={historyChart} alt="Season history" style={{ width: '100%' }} /> : <LoadingSpinner />}
      </div>
    );
  }
  const ordered = [...seasonHistory].sort((a, b) => b.season - a.season);
  return (
    <div className="card">
      <div className="card-title">Season history — profit</div>
      {ordered.map((s, i) => {
        const prior = ordered[i + 1];
        const trend = prior ? trendFor(s.profit, prior.profit, true) : null;
        return (
          <div className="season-mini" key={s.season}>
            <div className="sm-dot" style={{ background: TREATMENT_COLOR[s.farmingSystem] || '#9CA3AF' }} />
            <div className="sm-label">Season {s.season}</div>
            <div className="sm-val">{formatNumber(s.profit, 0)}</div>
            {trend ? (
              <span className={`sm-trend ${trend.favourable ? 'smt-g' : 'smt-r'}`}>
                {trend.arrow} {formatNumber(Math.abs(trend.delta), 0)}
              </span>
            ) : (
              <span className="sm-trend smt-g">First {s.farmingSystem} season</span>
            )}
          </div>
        );
      })}
      <div className="muted-note">Chart view unlocks once {HISTORY_CHART_THRESHOLD} or more seasons are recorded on this farm.</div>
    </div>
  );
}

function SoilHealthCard({ soilHealth }) {
  if (!soilHealth) {
    return (
      <div className="card">
        <div className="card-title">Soil health this season</div>
        <div className="muted-note">Not recorded this season.</div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-title">Soil health this season</div>
      <div className="mini-grid" style={{ marginBottom: 8 }}>
        <div className="mini">
          <div className="mini-val" style={{ color: '#166534' }}>
            {typeof soilHealth.soilScore?.value === 'number' ? formatNumber(soilHealth.soilScore.value, 1) : '—'}
          </div>
          <div className="mini-lbl">Soil score</div>
        </div>
        <div className="mini">
          <div className="mini-val" style={{ color: '#166534' }}>
            {typeof soilHealth.earthwormCount?.value === 'number' ? formatNumber(soilHealth.earthwormCount.value, 0) : '—'}
          </div>
          <div className="mini-lbl">Earthworms</div>
        </div>
        <div className="mini">
          <div className="mini-val" style={{ color: '#92400E' }}>
            {typeof soilHealth.weedPressureScore?.value === 'number' ? formatNumber(soilHealth.weedPressureScore.value, 1) : '—'}
          </div>
          <div className="mini-lbl">Weed score</div>
        </div>
      </div>
      {soilHealth.notes && <div style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>{soilHealth.notes}</div>}
    </div>
  );
}

function AlertsCard({ alerts }) {
  return (
    <div className="card">
      <div className="card-title">Alerts and insights</div>
      {alerts.map((a, i) => (
        <div className={`alert-item ai-${a.sev}`} key={i}>
          {a.text}
        </div>
      ))}
    </div>
  );
}

function QuickActionsCard({ season, setupId, gates }) {
  const remaining = gates.total - gates.filled;
  const items = [
    { icon: '📋', bg: '#EFF4FA', title: "Enter this season's data", sub: `${gates.total} gates — ${remaining} remaining`, to: `/seasons/${season._id}/data-entry` },
    { icon: '🧮', bg: '#F0FDF4', title: 'View CBA results', sub: remaining === 0 ? 'Computed' : 'Pending completion', to: `/seasons/${season._id}/cba` },
    { icon: '📈', bg: '#FFFBEB', title: 'See full season trend', sub: 'Profit, yield, soil health', to: `/trends/${setupId}` },
    { icon: '⚠️', bg: '#EAF3DE', title: 'Run risk scenarios', sub: 'Worst, normal, best case', to: `/scenarios/${setupId}` },
    { icon: '⬇️', bg: '#F8FAFC', title: 'Download season report', sub: remaining === 0 ? 'Report ready' : 'Complete data entry first', to: '/seasonal-reports' }
  ];
  return (
    <div className="card">
      <div className="card-title">Quick actions</div>
      {items.map((item) => (
        <Link className="nav-item" to={item.to} key={item.title}>
          <div className="ni-icon" style={{ background: item.bg }}>
            {item.icon}
          </div>
          <div className="ni-body">
            <div className="ni-title">{item.title}</div>
            <div className="ni-sub">{item.sub}</div>
          </div>
          <div className="ni-arr">›</div>
        </Link>
      ))}
    </div>
  );
}
