'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  BarChart3,
  CalendarDays,
  Download,
  Eye,
  Gauge,
  ImageIcon,
  LayoutGrid,
  LineChart,
  MousePointerClick,
  Search,
  Sparkles,
  Table2,
  TrendingUp,
  X
} from 'lucide-react';
import { compact, integer, money, percent } from '@/lib/format';
import './dashboard.css';

const metrics = [
  { key: 'spend', label: 'Spend', formatter: money, icon: Gauge },
  { key: 'impressions', label: 'Impressions', formatter: integer, icon: Eye },
  { key: 'reach', label: 'Reach', formatter: integer, icon: Sparkles },
  { key: 'clicks', label: 'Clicks', formatter: integer, icon: MousePointerClick },
  { key: 'engagements', label: 'Engagements', formatter: integer, icon: TrendingUp },
  { key: 'ctr', label: 'CTR', formatter: percent, icon: BarChart3 }
];

const metricMap = Object.fromEntries(metrics.map((metric) => [metric.key, metric]));

function sumRows(rows) {
  const total = rows.reduce((acc, row) => {
    acc.spend += Number(row.spend || 0);
    acc.sourceSpend += Number(row.sourceSpend || 0);
    acc.impressions += Number(row.impressions || 0);
    acc.reach += Number(row.reach || 0);
    acc.clicks += Number(row.clicks || 0);
    acc.engagements += Number(row.engagements || 0);
    return acc;
  }, { spend: 0, sourceSpend: 0, impressions: 0, reach: 0, clicks: 0, engagements: 0 });
  total.ctr = total.impressions ? (total.clicks / total.impressions) * 100 : 0;
  return total;
}

function matchText(row, query) {
  if (!query.trim()) return true;
  const haystack = [row.name, row.campaign, row.reportLabel].join(' ').toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function ChartTooltip({ point, metric }) {
  if (!point) return null;
  return (
    <div className="chart-tooltip" style={{ left: point.tooltipX, top: point.tooltipY }}>
      <strong>{point.label}</strong>
      <span>{metric.formatter(point.value)}</span>
      {'spend' in point.raw && <small>{money(point.raw.spend)} spend</small>}
    </div>
  );
}

function BarChart({ rows, metricKey, labelKey = 'label', compactLabels = false }) {
  const metric = metricMap[metricKey] || metricMap.spend;
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...rows.map((row) => Number(row[metricKey] || 0)), 1);
  const width = 820;
  const height = 300;
  const pad = { left: 46, right: 18, top: 20, bottom: 58 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const gap = 12;
  const barWidth = Math.max(18, (innerWidth - gap * Math.max(rows.length - 1, 0)) / Math.max(rows.length, 1));

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric.label} bar chart`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = pad.top + innerHeight - innerHeight * tick;
          return (
            <g key={tick}>
              <line className="gridline" x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
              <text className="axis-label" x={pad.left - 8} y={y + 4} textAnchor="end">{compact(max * tick)}</text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          const value = Number(row[metricKey] || 0);
          const barHeight = (value / max) * innerHeight;
          const x = pad.left + index * (barWidth + gap);
          const y = pad.top + innerHeight - barHeight;
          const active = hovered?.index === index;
          return (
            <g key={`${row[labelKey]}-${index}`}>
              <rect
                className={`bar ${active ? 'is-active' : ''}`}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="5"
                onMouseEnter={() => setHovered({
                  index,
                  label: row[labelKey],
                  value,
                  raw: row,
                  tooltipX: `${((x + barWidth / 2) / width) * 100}%`,
                  tooltipY: `${Math.max(10, (y / height) * 100 - 4)}%`
                })}
                onMouseLeave={() => setHovered(null)}
              />
              <text
                className="x-label"
                x={x + barWidth / 2}
                y={height - 30}
                textAnchor="middle"
              >
                {compactLabels ? String(row[labelKey]).replace(' 2026', '') : row[labelKey]}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip point={hovered} metric={metric} />
    </div>
  );
}

function LineChartPanel({ rows, metricKey }) {
  const metric = metricMap[metricKey] || metricMap.spend;
  const [hovered, setHovered] = useState(null);
  const width = 880;
  const height = 310;
  const pad = { left: 48, right: 24, top: 22, bottom: 46 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const max = Math.max(...rows.map((row) => Number(row[metricKey] || 0)), 1);
  const points = rows.map((row, index) => {
    const x = pad.left + (rows.length <= 1 ? 0 : (index / (rows.length - 1)) * innerWidth);
    const y = pad.top + innerHeight - (Number(row[metricKey] || 0) / max) * innerHeight;
    return { x, y, row, value: Number(row[metricKey] || 0) };
  });
  const d = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric.label} timeline chart`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = pad.top + innerHeight - innerHeight * tick;
          return (
            <g key={tick}>
              <line className="gridline" x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
              <text className="axis-label" x={pad.left - 8} y={y + 4} textAnchor="end">{compact(max * tick)}</text>
            </g>
          );
        })}
        <path className="area-line" d={`${d} L ${pad.left + innerWidth} ${pad.top + innerHeight} L ${pad.left} ${pad.top + innerHeight} Z`} />
        <path className="line" d={d} />
        {points.map((point, index) => (
          <circle
            key={`${point.row.date}-${index}`}
            className={`line-dot ${hovered?.index === index ? 'is-active' : ''}`}
            cx={point.x}
            cy={point.y}
            r={hovered?.index === index ? 7 : 4}
            onMouseEnter={() => setHovered({
              index,
              label: point.row.date,
              value: point.value,
              raw: point.row,
              tooltipX: `${(point.x / width) * 100}%`,
              tooltipY: `${Math.max(8, (point.y / height) * 100 - 5)}%`
            })}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        {points.filter((_, index) => index % Math.ceil(points.length / 6 || 1) === 0).map((point) => (
          <text key={point.row.date} className="x-label" x={point.x} y={height - 18} textAnchor="middle">
            {point.row.date.slice(5)}
          </text>
        ))}
      </svg>
      <ChartTooltip point={hovered} metric={metric} />
    </div>
  );
}

function MetricCard({ metric, value }) {
  const Icon = metric.icon;
  return (
    <div className="metric-card">
      <span className="metric-icon"><Icon size={17} /></span>
      <strong>{metric.formatter(value)}</strong>
      <span>{metric.label}</span>
    </div>
  );
}

function AdImage({ ad }) {
  if (!ad.image) {
    return (
      <div className="thumb-fallback">
        <ImageIcon size={28} />
        <span>{ad.reportShortLabel}</span>
      </div>
    );
  }
  const imageClass = ad.imageQuality === 'high' ? 'image-high' : 'image-standard';
  return (
    <>
      {ad.imageQuality !== 'high' && (
        <Image className="thumb-bg" src={ad.image} alt="" fill sizes="(max-width: 760px) 100vw, 260px" unoptimized />
      )}
      <Image className={`thumb-img ${imageClass}`} src={ad.image} alt="" fill sizes="(max-width: 760px) 100vw, 260px" unoptimized />
    </>
  );
}

export default function Dashboard({ initialSnapshot }) {
  const [period, setPeriod] = useState('all');
  const [campaign, setCampaign] = useState('all');
  const [metricKey, setMetricKey] = useState('spend');
  const [view, setView] = useState('overview');
  const [query, setQuery] = useState('');
  const [selectedAd, setSelectedAd] = useState(null);

  const reports = useMemo(() => initialSnapshot.reports || [], [initialSnapshot.reports]);
  const ads = useMemo(() => initialSnapshot.ads || [], [initialSnapshot.ads]);
  const campaigns = useMemo(() => {
    return [...new Set(ads.map((ad) => ad.campaign).filter(Boolean))].sort();
  }, [ads]);

  const filteredAds = useMemo(() => {
    return ads
      .filter((ad) => period === 'all' || ad.reportId === period)
      .filter((ad) => campaign === 'all' || ad.campaign === campaign)
      .filter((ad) => matchText(ad, query))
      .sort((a, b) => Number(b[metricKey] || 0) - Number(a[metricKey] || 0));
  }, [ads, period, campaign, query, metricKey]);

  const filteredReports = useMemo(() => {
    const active = reports.filter((report) => period === 'all' || report.id === period);
    if (campaign === 'all' && !query.trim()) return active;
    const activeIds = new Set(filteredAds.map((ad) => ad.reportId));
    return active.filter((report) => activeIds.has(report.id));
  }, [reports, period, campaign, query, filteredAds]);

  const totals = useMemo(() => sumRows(filteredAds), [filteredAds]);
  const dailyRows = useMemo(() => {
    return filteredReports
      .flatMap((report) => report.daily || [])
      .filter((row) => {
        if (campaign === 'all' && !query.trim()) return true;
        return filteredAds.some((ad) => ad.reportId === row.reportId);
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [filteredReports, filteredAds, campaign, query]);

  const reportRows = useMemo(() => filteredReports.map((report) => ({
    label: report.shortLabel,
    fullLabel: report.label,
    ...sumRows(filteredAds.filter((ad) => ad.reportId === report.id)),
    pdf: report.pdf
  })), [filteredReports, filteredAds]);

  const campaignRows = useMemo(() => {
    const grouped = filteredAds.reduce((acc, ad) => {
      acc[ad.campaign] ||= { campaign: ad.campaign, spend: 0, sourceSpend: 0, impressions: 0, reach: 0, clicks: 0, engagements: 0, ads: 0 };
      acc[ad.campaign].spend += ad.spend;
      acc[ad.campaign].sourceSpend += ad.sourceSpend;
      acc[ad.campaign].impressions += ad.impressions;
      acc[ad.campaign].reach += ad.reach;
      acc[ad.campaign].clicks += ad.clicks;
      acc[ad.campaign].engagements += ad.engagements;
      acc[ad.campaign].ads += 1;
      return acc;
    }, {});
    return Object.values(grouped)
      .map((row) => ({ ...row, ctr: row.impressions ? (row.clicks / row.impressions) * 100 : 0 }))
      .sort((a, b) => Number(b[metricKey] || 0) - Number(a[metricKey] || 0));
  }, [filteredAds, metricKey]);

  const visibleAds = filteredAds.slice(0, view === 'creative' ? 48 : 12);

  return (
    <main className="dashboard">
      <section className="hero">
        <div>
          <span className="eyebrow">Armaf USA</span>
          <h1>Paid Media Dashboard</h1>
          <p>Interactive reporting view powered by Supabase Lab and deployed on Vercel.</p>
        </div>
        <div className="hero-actions">
          <span>{initialSnapshot.source === 'supabase' ? 'Live backend' : 'Bundled fallback'}</span>
          <span>{new Date(initialSnapshot.backendUpdatedAt || initialSnapshot.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        </div>
      </section>

      <section className="toolbar">
        <label>
          Period
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="all">All periods</option>
            {reports.map((report) => <option key={report.id} value={report.id}>{report.label}</option>)}
          </select>
        </label>
        <label>
          Campaign
          <select value={campaign} onChange={(event) => setCampaign(event.target.value)}>
            <option value="all">All campaigns</option>
            {campaigns.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Metric
          <select value={metricKey} onChange={(event) => setMetricKey(event.target.value)}>
            {metrics.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}
          </select>
        </label>
        <label className="search-field">
          Search
          <span>
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad, campaign, month" />
          </span>
        </label>
      </section>

      <section className="view-tabs" aria-label="Dashboard views">
        {[
          ['overview', LayoutGrid, 'Overview'],
          ['timeline', LineChart, 'Timeline'],
          ['creative', ImageIcon, 'Creative'],
          ['table', Table2, 'Data']
        ].map(([key, Icon, label]) => (
          <button key={key} className={view === key ? 'is-active' : ''} onClick={() => setView(key)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </section>

      <section className="metrics">
        {metrics.map((metric) => <MetricCard key={metric.key} metric={metric} value={totals[metric.key]} />)}
      </section>

      {(view === 'overview' || view === 'timeline') && (
        <section className="grid two">
          <article className="panel">
            <div className="panel-head">
              <div>
                <span><CalendarDays size={15} /> Period comparison</span>
                <h2>{metricMap[metricKey].label} by report</h2>
              </div>
            </div>
            <BarChart rows={reportRows} metricKey={metricKey} labelKey="label" compactLabels />
          </article>
          <article className="panel">
            <div className="panel-head">
              <div>
                <span><TrendingUp size={15} /> Daily movement</span>
                <h2>{metricMap[metricKey].label} timeline</h2>
              </div>
            </div>
            <LineChartPanel rows={dailyRows} metricKey={metricKey} />
          </article>
        </section>
      )}

      {(view === 'overview' || view === 'creative') && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span><ImageIcon size={15} /> Creative performance</span>
              <h2>Top ads by {metricMap[metricKey].label.toLowerCase()}</h2>
            </div>
            <small>{filteredAds.length} ads in current view</small>
          </div>
          <div className="ad-grid">
            {visibleAds.map((ad) => (
              <button key={`${ad.reportId}-${ad.id}`} className="ad-card" onClick={() => setSelectedAd(ad)}>
                <div className="thumb">
                  <AdImage ad={ad} />
                  <span>{ad.imageQuality}</span>
                </div>
                <div className="ad-copy">
                  <strong>{ad.name}</strong>
                  <small>{ad.reportLabel}</small>
                  <div>
                    <b>{metricMap[metricKey].formatter(ad[metricKey])}</b>
                    <span>{money(ad.spend)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {(view === 'overview' || view === 'table') && (
        <section className="grid two table-grid">
          <article className="panel">
            <div className="panel-head">
              <div>
                <span><BarChart3 size={15} /> Campaigns</span>
                <h2>Campaign breakdown</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Ads</th>
                    <th>Spend</th>
                    <th>Impressions</th>
                    <th>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignRows.map((row) => (
                    <tr key={row.campaign}>
                      <td>{row.campaign}</td>
                      <td>{row.ads}</td>
                      <td>{money(row.spend)}</td>
                      <td>{integer(row.impressions)}</td>
                      <td>{percent(row.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="panel">
            <div className="panel-head">
              <div>
                <span><Download size={15} /> Reports</span>
                <h2>PDF exports</h2>
              </div>
            </div>
            <div className="report-list">
              {reports.map((report) => (
                <a key={report.id} href={report.pdf} target="_blank">
                  <span>{report.label}</span>
                  <Download size={16} />
                </a>
              ))}
            </div>
          </article>
        </section>
      )}

      {selectedAd && (
        <div className="modal-backdrop" onClick={() => setSelectedAd(null)}>
          <aside className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="close" onClick={() => setSelectedAd(null)} aria-label="Close"><X size={18} /></button>
            <div className="modal-image"><AdImage ad={selectedAd} /></div>
            <div className="modal-copy">
              <span>{selectedAd.reportLabel}</span>
              <h3>{selectedAd.name}</h3>
              <p>{selectedAd.campaign}</p>
              <div className="modal-metrics">
                {metrics.slice(0, 5).map((metric) => (
                  <div key={metric.key}>
                    <strong>{metric.formatter(selectedAd[metric.key])}</strong>
                    <span>{metric.label}</span>
                  </div>
                ))}
              </div>
              <div className="modal-links">
                <a href={selectedAd.pdf} target="_blank">Open report</a>
                {selectedAd.permalink && <a href={selectedAd.permalink} target="_blank">Open post</a>}
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
