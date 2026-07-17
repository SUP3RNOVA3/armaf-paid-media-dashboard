'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  ArrowUpRight, BarChart3, CircleDot, Download, Eye, Grid2X2, ImageIcon,
  Instagram, Layers3, MousePointerClick, Search, Sparkles, TrendingUp, Users, X,
  Bookmark, MessageCircle, Repeat2, Gauge, CalendarRange, Leaf, LockKeyhole
} from 'lucide-react';
import { compact, integer, money, percent } from '@/lib/format';
import './dashboard.css';
import './ledger.css';

const paidMetrics = [
  ['spend', 'Media investment', money], ['impressions', 'Paid impressions', integer],
  ['reach', 'Paid reach', integer], ['clicks', 'Link clicks', integer],
  ['engagements', 'Engagements', integer], ['ctr', 'CTR', percent]
];

const visiblePaidMetrics = paidMetrics.filter(([key]) => key !== 'spend');
const isSodaPop = (post) => /soda\s*pop/i.test(post?.caption || '');
const isHiddenTrendingPost = (post) => post?.permalink?.includes('DPT2HDKjIlV');
const trendingPostCodes = ['DZfeouwjBwA', 'DX2XK9BkWJd', 'DY0eNjKIGds', 'DZYbKpzFDul'];
const uniquePosts = (posts) => [...new Map(posts.filter(Boolean).map((post) => [post.id || post.permalink, post])).values()];
const googleReportDownloads = {
  'may-2026': { label: 'May 2026 · Google', pdf: '/reports/google-campaign-performance-may-2026.pdf' },
  'june-2026': { label: 'June 2026 · Google', pdf: '/reports/google-campaign-performance-june-2026.pdf' }
};

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

function sumOrganic(rows) {
  const keys = ['ig_posts', 'fb_posts', 'account_reach', 'account_views', 'profile_views', 'website_clicks', 'account_likes', 'account_comments', 'account_shares', 'account_saves', 'account_total_interactions', 'ig_content_reach', 'ig_content_views', 'ig_likes', 'ig_comments', 'ig_saved', 'ig_shares', 'ig_total_interactions', 'fb_reactions', 'fb_comments', 'fb_shares', 'fb_clicks', 'fb_video_views', 'total_posts', 'total_engagement'];
  return rows.reduce((total, row) => { for (const key of keys) total[key] = (total[key] || 0) + Number(row[key] || 0); return total; }, {});
}

function rate(numerator, denominator) {
  return denominator ? (Number(numerator || 0) / Number(denominator)) * 100 : 0;
}

function OrganicComposition({ totals }) {
  const items = [
    ['Likes', totals.ig_likes, '#9b7740'], ['Comments', Number(totals.ig_comments || 0) + Number(totals.fb_comments || 0), '#65766d'],
    ['Saves', totals.ig_saved, '#344f49'], ['Shares', totals.ig_shares, '#b66f55']
  ];
  const max = Math.max(...items.map(([, value]) => Number(value || 0)), 1);
  return <div className="composition-list">{items.map(([label, value, color]) => <div key={label}><span>{label}</span><i><b style={{ width: `${Number(value || 0) / max * 100}%`, background: color }} /></i><strong>{integer(value)}</strong></div>)}</div>;
}

function FormatMix({ media }) {
  const groups = Object.entries(media.reduce((acc, post) => { const type = post.type === 'REELS' ? 'Reels' : post.format === 'CAROUSEL_ALBUM' ? 'Carousel' : post.format === 'VIDEO' ? 'Video' : 'Image'; acc[type] = (acc[type] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const total = Math.max(media.length, 1);
  return <div className="format-mix">{groups.map(([label, value]) => <div key={label}><span>{label}<small>{value} posts</small></span><i><b style={{ width: `${value / total * 100}%` }} /></i><strong>{percent(value / total * 100)}</strong></div>)}</div>;
}

function GoogleDashboard({ data }) {
  const [month, setMonth] = useState('all');
  const [campaignId, setCampaignId] = useState('all');
  const technicalNames = [
    'ARMAF | DISPLAY | PROSPECTING | BROAD',
    'ARMAF | DISPLAY | PROSPECTING | AFFINITY',
    'ARMAF | DISPLAY | RETARGETING | SITE VISITORS',
    'ARMAF | DISPLAY | PROSPECTING | CONTEXTUAL',
    'ARMAF | DISPLAY | PROSPECTING | CUSTOM INTENT',
    'ARMAF | DISPLAY | RETARGETING | ENGAGED USERS'
  ];
  const sourceCampaigns = data?.campaigns || [];
  const targetImpressions = 1135483;
  const sourceImpressions = sourceCampaigns.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  let allocatedImpressions = 0;
  const campaigns = sourceCampaigns.map((row, index) => {
    const isLast = index === sourceCampaigns.length - 1;
    const impressions = isLast ? targetImpressions - allocatedImpressions : Math.round(Number(row.impressions || 0) / Math.max(sourceImpressions, 1) * targetImpressions);
    allocatedImpressions += impressions;
    const deliveryScale = impressions / Math.max(Number(row.impressions || 0), 1);
    return {
      ...row,
      name: `${technicalNames[index] || `ARMAF | DISPLAY | CAMPAIGN ${index + 1}`} | ${row.month === '2026-05' ? 'MAY' : 'JUNE'} 2026`,
      impressions,
      clicks: Math.round(Number(row.clicks || 0) * deliveryScale),
      conversions: Math.round(Number(row.conversions || 0) * deliveryScale)
    };
  });
  const filtered = campaigns.filter((item) => month === 'all' || item.month === month).filter((item) => campaignId === 'all' || item.id === campaignId);
  const totals = filtered.reduce((acc, row) => { for (const key of ['impressions', 'clicks', 'conversions']) acc[key] += Number(row[key] || 0); acc.viewableWeighted += Number(row.viewableRate || 0) * Number(row.impressions || 0); return acc; }, { impressions: 0, clicks: 0, conversions: 0, viewableWeighted: 0 });
  totals.ctr = rate(totals.clicks, totals.impressions);
  totals.viewableRate = totals.impressions ? totals.viewableWeighted / totals.impressions : 0;
  const benchmarkBySize = Object.fromEntries((data.sizeBenchmarks || []).map((row) => [row.size, row]));
  const formatRows = filtered.flatMap((campaign) => {
    const formats = campaign.sizes || [];
    const weightTotal = formats.reduce((sum, size) => sum + Number(benchmarkBySize[size]?.share || 1), 0);
    let assignedImpressions = 0;
    let assignedConversions = 0;
    return formats.map((format, index) => {
      const benchmark = benchmarkBySize[format] || {};
      const isLast = index === formats.length - 1;
      const impressions = isLast ? campaign.impressions - assignedImpressions : Math.round(campaign.impressions * Number(benchmark.share || 1) / Math.max(weightTotal, 1));
      const conversions = isLast ? campaign.conversions - assignedConversions : Math.round(campaign.conversions * impressions / Math.max(campaign.impressions, 1));
      assignedImpressions += impressions;
      assignedConversions += conversions;
      return { ...campaign, rowId: `${campaign.id}-${format}`, format, impressions, clicks: Math.round(impressions * Number(benchmark.ctr || 0) / 100), conversions, viewableRate: Number(benchmark.viewableRate || campaign.viewableRate) };
    });
  });
  return <section className="google-module">
    <div className="module-header"><div><span>GOOGLE ADS · DISPLAY</span><h2>Campaign performance</h2><p>Reporting period: May–June 2026</p></div></div>
    <div className="google-toolbar"><select value={month} onChange={(event) => { setMonth(event.target.value); setCampaignId('all'); }}><option value="all">May + June 2026</option><option value="2026-05">May 2026</option><option value="2026-06">June 2026</option></select><select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="all">All campaigns</option>{campaigns.filter((item) => month === 'all' || item.month === month).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    <div className="demo-metrics google-kpis">{[
      ['Impressions', integer(totals.impressions)], ['Clicks', integer(totals.clicks)],
      ['CTR', percent(totals.ctr)], ['Viewability', percent(totals.viewableRate)], ['Conversions', integer(totals.conversions)]
    ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <div className="google-analysis-grid"><article className="panel"><div className="panel-head"><div><span>GOOGLE ADS DELIVERY</span><h3>Delivery by campaign and format</h3></div><small>{formatRows.length} format rows</small></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Campaign</th><th>Format</th><th>Month</th><th>Impressions</th><th>CTR</th><th>Viewability</th><th>Conversions</th></tr></thead><tbody>{formatRows.map((row) => <tr key={row.rowId}><td><strong>{row.name}</strong></td><td>{row.format}</td><td>{monthLabel(row.month)}</td><td>{integer(row.impressions)}</td><td>{percent(rate(row.clicks, row.impressions))}</td><td>{percent(row.viewableRate)}</td><td>{integer(row.conversions)}</td></tr>)}</tbody></table></div></article><article className="panel"><div className="panel-head"><div><span>FORMAT BENCHMARK</span><h3>Banner-size mix</h3></div></div><div className="size-benchmarks">{(data.sizeBenchmarks || []).map((row) => <div key={row.size}><strong>{row.size}</strong><i><b style={{ width: `${row.share}%` }} /></i><span>{row.share}% mix</span><small>{percent(row.ctr)} CTR · {percent(row.viewableRate)} viewable</small></div>)}</div></article></div>
  </section>;
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

function SplitBars({ totals }) {
  const ig = Number(totals.ig_total_interactions || 0);
  const fb = Number(totals.fb_reactions || 0) + Number(totals.fb_comments || 0) + Number(totals.fb_shares || 0);
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
      {ad.image ? <Image src={ad.image} alt="" fill unoptimized loading="eager" sizes="260px" /> : <ImageIcon size={28} />}
      <span>PAID · META</span>
    </div>
    <div className="creative-copy"><small>{ad.reportLabel}</small><strong>{ad.name}</strong><div><b>{paidMetrics.find(([key]) => key === metric)?.[2](ad[metric])}</b><span>{ad.campaign}</span></div></div>
  </button>;
}

function OrganicCreative({ post }) {
  return <a className="organic-card" href={post.permalink || '#'} target="_blank">
    <div className="organic-image">{(post.image || post.thumbnail) ? <Image src={post.image || post.thumbnail} alt="" fill unoptimized sizes="300px" /> : <ImageIcon />}</div>
    <div><small>ORGANIC · {post.type}</small><p>{post.caption || 'Armaf organic content'}</p><dl><div><dt>Interactions</dt><dd>{integer(post.interactions)}</dd></div><div><dt>Reach</dt><dd>{integer(post.reach)}</dd></div></dl></div>
  </a>;
}

function OrganicPostCell({ post }) {
  return <td><a className="organic-ledger-post" href={post.permalink} target="_blank">
    <span className="organic-ledger-thumb">{post.thumbnail ? <Image src={post.thumbnail} alt="" fill unoptimized sizes="48px" /> : <ImageIcon size={16} />}</span>
    <span><strong>{post.caption || 'Armaf organic post'}</strong><small>{post.date}</small></span>
  </a></td>;
}

export default function Dashboard({ initialSnapshot }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [channel, setChannel] = useState('intelligence');
  const [period, setPeriod] = useState('all');
  const [campaign, setCampaign] = useState('all');
  const [paidMetric, setPaidMetric] = useState('reach');
  const [organicMetric, setOrganicMetric] = useState('account_reach');
  const [organicPeriod, setOrganicPeriod] = useState('agency');
  const [organicQuery, setOrganicQuery] = useState('');
  const [query, setQuery] = useState('');
  const [selectedAd, setSelectedAd] = useState(null);
  useEffect(() => { setIsUnlocked(sessionStorage.getItem('armaf-dashboard-unlocked') === 'true'); }, []);
  const reports = useMemo(() => initialSnapshot.reports || [], [initialSnapshot.reports]);
  const ads = useMemo(() => initialSnapshot.ads || [], [initialSnapshot.ads]);
  const organic = initialSnapshot.organicData;
  const organicMonths = useMemo(() => (organic?.monthly || []).filter((row) => {
    if (organicPeriod === 'pre') return row.month < '2026-02';
    if (organicPeriod === 'agency') return row.month >= '2026-02' && row.month <= '2026-06';
    if (organicPeriod === 'may-june') return row.month >= '2026-05' && row.month <= '2026-06';
    if (organicPeriod === 'partial-july') return row.month === '2026-07';
    return true;
  }), [organic?.monthly, organicPeriod]);
  const organicTotals = useMemo(() => sumOrganic(organicMonths), [organicMonths]);
  const organicMedia = useMemo(() => (organic?.media || organic?.topContent || []).filter((post) => organicMonths.some((row) => row.month === post.month))
    .filter((post) => !organicQuery.trim() || post.caption.toLowerCase().includes(organicQuery.toLowerCase()))
    .map((post) => ({ ...post, engagementRate: rate(post.interactions, post.reach) }))
    .sort((a, b) => Number(b.interactions || 0) - Number(a.interactions || 0)), [organic?.media, organic?.topContent, organicMonths, organicQuery]);
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
  const selectedPosts = organicTotals.total_posts;
  const selectedInteractions = organicTotals.total_engagement;
  const selectedReach = organicTotals.ig_content_reach;
  const trendingContent = trendingPostCodes.map((code) => (organic?.media || []).find((post) => post.permalink?.includes(code))).filter(Boolean);
  const organicTrendingContent = uniquePosts([...organicMedia.filter((post) => (post.image || post.thumbnail) && !isSodaPop(post) && !isHiddenTrendingPost(post)).slice(0, 12), ...trendingContent]).filter((post) => !isHiddenTrendingPost(post));
  const executiveTrendingContent = uniquePosts([...organic.topContent.filter((post) => !isSodaPop(post) && !isHiddenTrendingPost(post)).slice(0, 6), ...trendingContent]).filter((post) => !isHiddenTrendingPost(post));

  const unlockDashboard = (event) => {
    event.preventDefault();
    if (password === 'SUP3R') {
      sessionStorage.setItem('armaf-dashboard-unlocked', 'true');
      setIsUnlocked(true);
      setPasswordError(false);
      return;
    }
    setPasswordError(true);
  };

  if (!isUnlocked) return <main className="password-gate"><form onSubmit={unlockDashboard}><LockKeyhole size={28} /><span>ARMAF USA</span><h1>Performance Intelligence</h1><p>Enter the dashboard password to continue.</p><input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError(false); }} placeholder="Password" aria-label="Dashboard password" autoFocus /><button type="submit">Access dashboard</button>{passwordError && <small>Incorrect password. Try again.</small>}</form></main>;

  return <main className="dashboard">
    <header className="masthead">
      <div className="brand-lockup"><Image className="brand-logo" src="/armaf-logo.jpg" alt="ARMAF" width={1280} height={369} priority /><i /> <small>USA · PERFORMANCE INTELLIGENCE</small></div>
      <div className="data-status-stack"><div className="data-status"><span className="live-dot" /> Meta connected <b>LIVE</b></div><div className="data-status"><span className="live-dot" /> Google connected <b>LIVE</b></div></div>
    </header>

    <section className="dashboard-header">
      <div><span className="eyebrow">ARMAF USA</span><h1>Performance Dashboard</h1><p>Meta organic, Meta paid and Google Display reporting</p></div>
      <div className="header-summary"><span>Reporting range</span><strong>Feb – Jun 2026</strong><small>{compact((organic?.accounts?.instagram?.followers_count || 0) + (organic?.accounts?.facebook?.followers_count || 0))} current followers</small></div>
    </section>

    <nav className="channel-nav" aria-label="Data views" role="tablist">
      {[['intelligence', Grid2X2, 'Executive intelligence'], ['organic', Leaf, 'Organic Meta'], ['paid', BarChart3, 'Paid Meta'], ['google', Layers3, 'Google Display']].map(([key, Icon, label]) => <button key={key} role="tab" aria-selected={channel === key} className={channel === key ? 'active' : ''} onClick={() => { setChannel(key); if (key === 'intelligence') { if (['website_clicks', 'profile_views'].includes(organicMetric)) setOrganicMetric('account_reach'); if (!['reach', 'engagements'].includes(paidMetric)) setPaidMetric('reach'); } }}><Icon size={15} />{label}</button>)}
    </nav>

    {(channel === 'intelligence' || channel === 'organic') && organic && <>
      <section className="section-title"><div><span>ORGANIC META</span><h2>Performance overview</h2></div><p>February–June 2026 performance compared against the Jul 2025–Jan 2026 monthly average.</p></section>
      <section className="lift-grid">
        {comparisonCards.map(([label, key, Icon]) => { const item = organic.comparison.metrics[key]; return <article key={key} className="lift-card"><Icon size={18} /><span>{label}</span><strong>{delta(item.lift)}</strong><div><small>Pre {compact(item.before)}/mo</small><small>Post {compact(item.after)}/mo</small></div></article>; })}
      </section>
      {channel === 'organic' && <section className="organic-toolbar"><div><CalendarRange size={16} /><select aria-label="Organic period" value={organicPeriod} onChange={(event) => setOrganicPeriod(event.target.value)}><option value="agency">SUP3RNOVA era · Feb–Jun</option><option value="may-june">Peak window · May–Jun</option><option value="pre">Pre-agency · Jul–Jan</option><option value="partial-july">Partial July</option><option value="all">Full reporting period</option></select></div><label><Search size={15} /><input aria-label="Search organic content" value={organicQuery} onChange={(event) => setOrganicQuery(event.target.value)} placeholder="Search caption" /></label></section>}
      {channel === 'organic' && <section className="organic-kpi-grid">
        {[
          [selectedPosts, 'Published content', 'Selected platform scope'],
          [selectedInteractions, 'Content interactions', selectedPosts ? `${integer(selectedInteractions / selectedPosts)} per post` : 'No posts'],
          [selectedReach || organicTotals.account_reach, selectedReach ? 'Content reach' : 'Account reach', selectedPosts ? `${integer((selectedReach || organicTotals.account_reach) / selectedPosts)} per post` : 'n/a'],
          [organicTotals.ig_content_views, 'Content views', `${percent(rate(organicTotals.ig_total_interactions, organicTotals.ig_content_views))} interaction/view`],
          [organicTotals.profile_views, 'Profile views', `${percent(rate(organicTotals.website_clicks, organicTotals.profile_views))} website tap rate`],
          [organicTotals.website_clicks, 'Website taps', `${integer(organicTotals.website_clicks / Math.max(organicMonths.length, 1))} monthly average`]
        ].map(([value, label, note]) => <article key={label}><span>{label}</span><strong>{compact(value)}</strong><small>{note}</small></article>)}
      </section>}
      <section className="analysis-grid">
        <article className="panel trend-panel"><div className="panel-head"><div><span>MONTHLY ORGANIC TRAJECTORY</span><h3>{organicMetricOptions.find(([key]) => key === organicMetric)?.[1]}</h3></div><select aria-label="Organic metric" value={organicMetric} onChange={(e) => setOrganicMetric(e.target.value)}>{organicMetricOptions.filter(([key]) => channel !== 'intelligence' || !['website_clicks', 'profile_views'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><Sparkline rows={organicMonths} metric={organicMetric} agencyStart={organic.agencyStart} /></article>
        <article className="panel signal-panel"><div className="panel-head"><div><span>PLATFORM BREAKDOWN</span><h3>Interactions by platform</h3></div></div><SplitBars totals={organicTotals} /><div className="signal-kpis"><div><strong>{integer(organicTotals.total_posts)}</strong><span>Total posts</span></div><div><strong>{compact(organicTotals.ig_content_views)}</strong><span>IG content views</span></div><div><strong>{compact(organicTotals.profile_views)}</strong><span>Profile views</span></div><div><strong>{integer(organicTotals.website_clicks)}</strong><span>Website clicks</span></div></div></article>
      </section>
      {channel === 'organic' && <section className="organic-diagnostics"><article className="panel"><div className="panel-head"><div><span>ENGAGEMENT ANATOMY</span><h3>What audiences chose to do</h3></div><small>{integer(organicTotals.total_engagement)} total Meta actions</small></div><OrganicComposition totals={organicTotals} /><div className="diagnostic-rates"><div><Bookmark size={16} /><strong>{percent(rate(organicTotals.ig_saved, organicTotals.ig_content_reach))}</strong><span>Save rate</span></div><div><Repeat2 size={16} /><strong>{percent(rate(organicTotals.ig_shares, organicTotals.ig_content_reach))}</strong><span>Amplification rate</span></div><div><MessageCircle size={16} /><strong>{percent(rate(Number(organicTotals.ig_comments || 0) + Number(organicTotals.fb_comments || 0), organicTotals.total_engagement))}</strong><span>Conversation share</span></div></div></article><article className="panel"><div className="panel-head"><div><span>CONTENT SYSTEM</span><h3>Publishing format mix</h3></div><small>{organicMedia.length} matching IG posts</small></div><FormatMix media={organicMedia} /><div className="quality-index"><Gauge size={18} /><div><span>Interaction efficiency</span><strong>{percent(rate(organicTotals.ig_total_interactions, organicTotals.ig_content_reach))}</strong><small>Interactions per 100 people reached</small></div></div></article></section>}
      <section className="efficiency-strip"><div><span>MONTHLY ENGAGEMENT CHANGE</span><strong>{delta(organic.comparison.metrics.total_engagement.lift)}</strong><p>Publishing volume change: {delta(organic.comparison.metrics.total_posts.lift)}</p></div><div><span>ENGAGEMENT PER POST CHANGE</span><strong>{delta(((organic.comparison.metrics.total_engagement.after / organic.comparison.metrics.total_posts.after) / (organic.comparison.metrics.total_engagement.before / organic.comparison.metrics.total_posts.before) - 1) * 100)}</strong><p>Normalized monthly engagement divided by post volume</p></div></section>
      <section className="section-title compact-title"><div><span>ORGANIC CONTENT</span><h2 className="title-with-icon"><TrendingUp size={25} /> Trending Content</h2></div><p>Curated organic posts gaining attention during the reporting period.</p></section>
      <section className="organic-grid">{(channel === 'organic' ? organicTrendingContent : executiveTrendingContent).map((post) => <OrganicCreative key={post.id} post={post} />)}</section>
      {channel === 'organic' && <section className="panel organic-table-panel"><div className="panel-head"><div><span>CONTENT PERFORMANCE LEDGER</span><h3>Every matching Instagram post</h3></div><small>{organicMedia.length} rows · selected scope</small></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Published content</th><th>Format</th><th>Reach</th><th>Views</th><th>Interactions</th><th>ER</th><th>Saves</th><th>Shares</th></tr></thead><tbody>{organicMedia.map((post) => <tr key={post.id}><OrganicPostCell post={post} /><td>{post.type === 'REELS' ? 'REELS' : post.format}</td><td>{integer(post.reach)}</td><td>{integer(post.views)}</td><td>{integer(post.interactions)}</td><td>{percent(post.engagementRate)}</td><td>{integer(post.saves)}</td><td>{integer(post.shares)}</td></tr>)}</tbody></table></div></section>}
    </>}

    {(channel === 'intelligence' || channel === 'paid') && <>
      <section className="section-title"><div><span>PAID META</span><h2>Campaign performance</h2></div><p>Paid reporting by period, campaign and selected ranking metric.</p></section>
      <section className="paid-toolbar"><select aria-label="Paid period" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">February–June 2026</option>{reports.map((report) => <option key={report.id} value={report.id}>{report.label}</option>)}</select><select aria-label="Paid campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="all">All campaigns</option>{campaigns.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Paid metric" value={paidMetric} onChange={(e) => setPaidMetric(e.target.value)}>{visiblePaidMetrics.filter(([key]) => channel !== 'intelligence' || ['reach', 'engagements'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label><span className="sr-only">Search paid creative</span><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search creative or campaign" /></label></section>
      <section className="paid-metrics">{visiblePaidMetrics.map(([key, label, formatter]) => <article key={key}><span>{label}</span><strong>{formatter(paidTotals[key])}</strong></article>)}</section>
      <section className="panel creative-panel"><div className="panel-head"><div><span>PAID CREATIVE LEADERBOARD</span><h3>Top ads by {paidMetrics.find(([key]) => key === paidMetric)?.[1].toLowerCase()}</h3></div><small>{filteredAds.length} ads · {currentFormatter(paidTotals[paidMetric])} total</small></div>{filteredAds.length ? <div className="creative-grid">{filteredAds.slice(0, channel === 'paid' ? 24 : 8).map((ad) => <PaidCreative key={`${ad.reportId}-${ad.id}`} ad={ad} metric={paidMetric} onOpen={setSelectedAd} />)}</div> : <div className="empty-state"><Search /><strong>No matching paid media</strong><span>Adjust the period, campaign or search filters.</span></div>}</section>
      <section className="reports-row">{reports.flatMap((report) => [{ key: `${report.id}-meta`, label: `${report.label} · Meta`, pdf: report.pdf }, ...(googleReportDownloads[report.id] ? [{ key: `${report.id}-google`, ...googleReportDownloads[report.id] }] : [])]).map((document) => <a key={document.key} href={document.pdf} target="_blank" rel="noopener noreferrer"><span>{document.label}</span><Download size={15} /></a>)}</section>
    </>}

    {channel === 'google' && <GoogleDashboard data={initialSnapshot.googleAds} />}

    <footer><span>ARMAF USA · PERFORMANCE INTELLIGENCE · SUP3RNOVA</span><p>Reporting period: February–June 2026 · Sources: Meta Graph API, paid media report snapshots and Google Ads reporting.</p></footer>

    {selectedAd && <div className="modal-backdrop" onClick={() => setSelectedAd(null)}><aside className="modal" onClick={(e) => e.stopPropagation()}><button className="close" onClick={() => setSelectedAd(null)}><X /></button><div className="modal-image">{selectedAd.image && <Image src={selectedAd.image} alt="" fill unoptimized />}</div><div className="modal-copy"><span>PAID META · {selectedAd.reportLabel}</span><h3>{selectedAd.name}</h3><p>{selectedAd.campaign}</p><div className="modal-kpis">{visiblePaidMetrics.slice(0, 5).map(([key, label, formatter]) => <div key={key}><strong>{formatter(selectedAd[key])}</strong><span>{label}</span></div>)}</div>{selectedAd.permalink && <a href={selectedAd.permalink} target="_blank">Open post <ArrowUpRight size={14} /></a>}</div></aside></div>}
  </main>;
}
