'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  ArrowUpRight, BarChart3, CircleDot, Download, Eye, Grid2X2, ImageIcon,
  Instagram, Layers3, MousePointerClick, Search, Sparkles, TrendingUp, Users, X
} from 'lucide-react';
import { compact, integer, money, percent } from '@/lib/format';
import './dashboard.css';

const paidMetrics = [
  ['spend', 'Media investment', money], ['impressions', 'Paid impressions', integer],
  ['reach', 'Paid reach', integer], ['clicks', 'Link clicks', integer],
  ['engagements', 'Engagements', integer], ['ctr', 'CTR', percent]
];

const organicMetricOptions = [
  ['account_reach', 'Account reach'], ['account_views', 'Account views'],
  ['account_total_interactions', 'Account interactions'], ['profile_views', 'Profile views'],
  ['website_clicks', 'Website clicks'], ['total_engagement', 'Content engagement']
];

function sumRows(rows) {
  const total = rows.reduce((acc, row) => {
    for (const key of ['spend', 'sourceSpend', 'impressions', 'reach', 'clicks', 'engagements']) acc[key] += Number(row[key] || 0);
    return acc;
  }, { spend: 0, sourceSpend: 0, impressions: 0, reach: 0, clicks: 0, engagements: 0 });
  total.ctr = total.impressions ? (total.clicks / total.impressions) * 100 : 0;
  return total;
}

function delta(value) {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function monthLabel(value) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1));
}

function Sparkline({ rows, metric, agencyStart }) {
  const width = 920;
  const height = 300;
  const pad = { l: 40, r: 20, t: 22, b: 38 };
  const values = rows.map((row) => Number(row[metric] || 0));
  const max = Math.max(...values, 1);
  const x = (i) => pad.l + (i / Math.max(rows.length - 1, 1)) * (width - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const line = values.map((value, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(value)}`).join(' ');
  const startIndex = rows.findIndex((row) => row.month === agencyStart.slice(0, 7));
  const agencyX = startIndex >= 0 ? x(startIndex) : 0;
  return (
    <div className="chart-frame">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Organic monthly trend">
        {[0, .25, .5, .75, 1].map((tick) => <g key={tick}>
          <line className="gridline" x1={pad.l} x2={width - pad.r} y1={y(max * tick)} y2={y(max * tick)} />
          <text className="axis-label" x={pad.l - 8} y={y(max * tick) + 4} textAnchor="end">{compact(max * tick)}</text>
        </g>)}
        {startIndex >= 0 && <g>
          <rect className="agency-zone" x={agencyX} y={pad.t} width={width - pad.r - agencyX} height={height - pad.t - pad.b} />
          <line className="agency-line" x1={agencyX} x2={agencyX} y1={pad.t} y2={height - pad.b} />
          <text className="agency-label" x={agencyX + 9} y={pad.t + 16}>SUP3RNOVA stewardship</text>
        </g>}
        <path className="organic-area" d={`${line} L ${x(values.length - 1)} ${height - pad.b} L ${x(0)} ${height - pad.b} Z`} />
        <path className="organic-line" d={line} />
        {values.map((value, i) => <g key={rows[i].month}>
          <circle className="organic-dot" cx={x(i)} cy={y(value)} r="4"><title>{`${monthLabel(rows[i].month)}: ${integer(value)}`}</title></circle>
          <text className="x-label" x={x(i)} y={height - 14} textAnchor="middle">{i % 2 === 0 || rows.length < 9 ? monthLabel(rows[i].month).replace(' ', ' ’') : ''}</text>
        </g>)}
      </svg>
    </div>
  );
}

function SplitBars({ organic }) {
  const ig = organic.totals.ig_total_interactions || 0;
  const fb = organic.totals.fb_engagement || 0;
  const total = Math.max(ig + fb, 1);
  return <div className="platform-bars">
    <div><span><Instagram size={15} /> Instagram</span><strong>{integer(ig)}</strong><i style={{ width: `${ig / total * 100}%` }} /></div>
    <div><span><CircleDot size={15} /> Facebook</span><strong>{integer(fb)}</strong><i style={{ width: `${Math.max(fb / total * 100, 1.5)}%` }} /></div>
    <p>Content interactions by platform. Facebook excludes metrics no longer exposed by New Pages Experience.</p>
  </div>;
}

function PaidCreative({ ad, metric, onOpen }) {
  return <button className="creative-card" onClick={() => onOpen(ad)}>
    <div className="creative-image">
      {ad.image ? <Image src={ad.image} alt="" fill unoptimized sizes="260px" /> : <ImageIcon size={28} />}
      <span>PAID · META</span>
    </div>
    <div className="creative-copy"><small>{ad.reportLabel}</small><strong>{ad.name}</strong><div><b>{paidMetrics.find(([key]) => key === metric)?.[2](ad[metric])}</b><span>{ad.campaign}</span></div></div>
  </button>;
}

function OrganicCreative({ post }) {
  return <a className="organic-card" href={post.permalink || '#'} target="_blank">
    <div className="organic-image">{post.image ? <Image src={post.image} alt="" fill unoptimized sizes="300px" /> : <ImageIcon />}</div>
    <div><small>ORGANIC · {post.type}</small><p>{post.caption || 'Armaf organic content'}</p><dl><div><dt>Interactions</dt><dd>{integer(post.interactions)}</dd></div><div><dt>Reach</dt><dd>{integer(post.reach)}</dd></div></dl></div>
  </a>;
}

export default function Dashboard({ initialSnapshot }) {
  const [channel, setChannel] = useState('intelligence');
  const [period, setPeriod] = useState('all');
  const [campaign, setCampaign] = useState('all');
  const [paidMetric, setPaidMetric] = useState('spend');
  const [organicMetric, setOrganicMetric] = useState('account_reach');
  const [query, setQuery] = useState('');
  const [selectedAd, setSelectedAd] = useState(null);
  const reports = useMemo(() => initialSnapshot.reports || [], [initialSnapshot.reports]);
  const ads = useMemo(() => initialSnapshot.ads || [], [initialSnapshot.ads]);
  const organic = initialSnapshot.organicData;
  const campaigns = useMemo(() => [...new Set(ads.map((ad) => ad.campaign).filter(Boolean))].sort(), [ads]);
  const filteredAds = useMemo(() => ads.filter((ad) => period === 'all' || ad.reportId === period)
    .filter((ad) => campaign === 'all' || ad.campaign === campaign)
    .filter((ad) => !query.trim() || `${ad.name} ${ad.campaign}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(b[paidMetric] || 0) - Number(a[paidMetric] || 0)), [ads, period, campaign, query, paidMetric]);
  const paidTotals = useMemo(() => sumRows(filteredAds), [filteredAds]);
  const comparisonCards = organic ? [
    ['Account reach', 'account_reach', Users], ['Account views', 'account_views', Eye],
    ['Content engagement', 'total_engagement', Sparkles], ['Website clicks', 'website_clicks', MousePointerClick]
  ] : [];
  const currentFormatter = paidMetrics.find(([key]) => key === paidMetric)?.[2] || integer;

  return <main className="dashboard">
    <header className="masthead">
      <div className="brand-lockup"><span>ARMAF</span><i /> <small>USA · PERFORMANCE INTELLIGENCE</small></div>
      <div className="data-status"><span className="live-dot" /> Meta connected <b>{initialSnapshot.source === 'supabase' ? 'LIVE' : 'SNAPSHOT'}</b></div>
    </header>

    <section className="hero">
      <div><span className="eyebrow">Unified brand signal · Jul 2025–Jul 2026</span><h1>Media, culture<br />and <em>momentum.</em></h1><p>One executive view of organic brand behavior and paid media performance, with explicit source boundaries and normalized agency-era comparisons.</p></div>
      <div className="hero-stat"><span>Current community</span><strong>{compact((organic?.accounts?.instagram?.followers_count || 0) + (organic?.accounts?.facebook?.followers_count || 0))}</strong><small>Instagram + Facebook followers · current snapshot</small></div>
    </section>

    <nav className="channel-nav" aria-label="Data views" role="tablist">
      {[['intelligence', Grid2X2, 'Executive intelligence'], ['organic', Sparkles, 'Organic Meta'], ['paid', BarChart3, 'Paid Meta'], ['google', Layers3, 'Google Display']].map(([key, Icon, label]) => <button key={key} role="tab" aria-selected={channel === key} className={channel === key ? 'active' : ''} onClick={() => setChannel(key)}><Icon size={15} />{label}{key === 'google' && <small>DEMO</small>}</button>)}
    </nav>

    {(channel === 'intelligence' || channel === 'organic') && organic && <>
      <section className="section-title"><div><span>01 · Organic behavior</span><h2>The agency-era signal</h2></div><p>Monthly averages compare Jul 2025–Jan 2026 with Feb–Jun 2026. Partial July is visible in trends but excluded from the post-agency average.</p></section>
      <section className="lift-grid">
        {comparisonCards.map(([label, key, Icon]) => { const item = organic.comparison.metrics[key]; return <article key={key} className="lift-card"><Icon size={18} /><span>{label}</span><strong>{delta(item.lift)}</strong><div><small>Pre {compact(item.before)}/mo</small><small>Post {compact(item.after)}/mo</small></div></article>; })}
      </section>
      <section className="analysis-grid">
        <article className="panel trend-panel"><div className="panel-head"><div><span>MONTHLY ORGANIC TRAJECTORY</span><h3>{organicMetricOptions.find(([key]) => key === organicMetric)?.[1]}</h3></div><select aria-label="Organic metric" value={organicMetric} onChange={(e) => setOrganicMetric(e.target.value)}>{organicMetricOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><Sparkline rows={organic.monthly} metric={organicMetric} agencyStart={organic.agencyStart} /></article>
        <article className="panel signal-panel"><div className="panel-head"><div><span>PLATFORM SIGNAL</span><h3>Instagram leads culture</h3></div></div><SplitBars organic={organic} /><div className="signal-kpis"><div><strong>{integer(organic.totals.total_posts)}</strong><span>Total posts</span></div><div><strong>{compact(organic.totals.ig_content_views)}</strong><span>IG content views</span></div><div><strong>{compact(organic.totals.profile_views)}</strong><span>Profile views</span></div><div><strong>{integer(organic.totals.website_clicks)}</strong><span>Website clicks</span></div></div></article>
      </section>
      <section className="efficiency-strip"><div><span>EFFICIENCY INDEX</span><strong>{delta(organic.comparison.metrics.total_engagement.lift)}</strong><p>Monthly content engagement lift while publishing cadence moved only {delta(organic.comparison.metrics.total_posts.lift)}. The gain is efficiency-led, not volume-led.</p></div><div><span>ENGAGEMENT / POST</span><strong>{delta(((organic.comparison.metrics.total_engagement.after / organic.comparison.metrics.total_posts.after) / (organic.comparison.metrics.total_engagement.before / organic.comparison.metrics.total_posts.before) - 1) * 100)}</strong><p>Derived from normalized monthly engagement divided by monthly post volume.</p></div></section>
      <section className="section-title compact-title"><div><span>02 · Organic creative</span><h2>Content that moved people</h2></div><p>Ranked by lifetime interactions for media published during the reporting period.</p></section>
      <section className="organic-grid">{organic.topContent.slice(0, channel === 'organic' ? 12 : 6).map((post) => <OrganicCreative key={post.id} post={post} />)}</section>
    </>}

    {(channel === 'intelligence' || channel === 'paid') && <>
      <section className="section-title"><div><span>03 · Paid Meta</span><h2>Investment performance</h2></div><p>Paid-only reporting. Modeled spend values remain separate from all organic totals.</p></section>
      <section className="paid-toolbar"><select aria-label="Paid period" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">All paid periods</option>{reports.map((report) => <option key={report.id} value={report.id}>{report.label}</option>)}</select><select aria-label="Paid campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="all">All campaigns</option>{campaigns.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Paid metric" value={paidMetric} onChange={(e) => setPaidMetric(e.target.value)}>{paidMetrics.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label><span className="sr-only">Search paid creative</span><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search creative or campaign" /></label></section>
      <section className="paid-metrics">{paidMetrics.map(([key, label, formatter]) => <article key={key}><span>{label}</span><strong>{formatter(paidTotals[key])}</strong></article>)}</section>
      <section className="panel creative-panel"><div className="panel-head"><div><span>PAID CREATIVE LEADERBOARD</span><h3>Top ads by {paidMetrics.find(([key]) => key === paidMetric)?.[1].toLowerCase()}</h3></div><small>{filteredAds.length} ads · {currentFormatter(paidTotals[paidMetric])} total</small></div>{filteredAds.length ? <div className="creative-grid">{filteredAds.slice(0, channel === 'paid' ? 24 : 8).map((ad) => <PaidCreative key={`${ad.reportId}-${ad.id}`} ad={ad} metric={paidMetric} onOpen={setSelectedAd} />)}</div> : <div className="empty-state"><Search /><strong>No matching paid media</strong><span>Adjust the period, campaign or search filters.</span></div>}</section>
      <section className="reports-row">{reports.map((report) => <a key={report.id} href={report.pdf} target="_blank"><span>{report.label}</span><Download size={15} /></a>)}</section>
    </>}

    {channel === 'google' && <section className="google-module"><div className="demo-badge">PLACEHOLDER · AWAITING CONNECTION</div><div className="google-hero"><div><span>GOOGLE ADS · DISPLAY</span><h2>Banner intelligence<br />will live here.</h2><p>Illustrative layout and demo numbers only. None of these values are included in executive, paid or blended totals.</p></div><div className="banner-demo"><span>ARMAF</span><strong>The scent of<br />modern presence.</strong><button>Discover the collection <ArrowUpRight size={14} /></button></div></div><div className="demo-metrics">{Object.entries(initialSnapshot.googleAds?.demoMetrics || {}).map(([key, value]) => <article key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><strong>{key === 'ctr' || key === 'viewableRate' ? percent(value) : key === 'cpm' ? money(value) : integer(value)}</strong><small>DEMO VALUE</small></article>)}</div><div className="connection-state"><CircleDot /><div><strong>Google Ads connection pending</strong><span>Once connected, this module will expose campaign, placement, creative-size, viewability and assisted-traffic signals for Display.</span></div></div></section>}

    <footer><span>ARMAF USA · PERFORMANCE INTELLIGENCE</span><p>Sources: Meta Graph API, paid media report snapshots, Supabase Lab. Organic period ends Jul 12, 2026; July is partial.</p></footer>

    {selectedAd && <div className="modal-backdrop" onClick={() => setSelectedAd(null)}><aside className="modal" onClick={(e) => e.stopPropagation()}><button className="close" onClick={() => setSelectedAd(null)}><X /></button><div className="modal-image">{selectedAd.image && <Image src={selectedAd.image} alt="" fill unoptimized />}</div><div className="modal-copy"><span>PAID META · {selectedAd.reportLabel}</span><h3>{selectedAd.name}</h3><p>{selectedAd.campaign}</p><div className="modal-kpis">{paidMetrics.slice(0, 5).map(([key, label, formatter]) => <div key={key}><strong>{formatter(selectedAd[key])}</strong><span>{label}</span></div>)}</div>{selectedAd.permalink && <a href={selectedAd.permalink} target="_blank">Open post <ArrowUpRight size={14} /></a>}</div></aside></div>}
  </main>;
}
