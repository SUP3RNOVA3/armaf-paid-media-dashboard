import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = process.env.ARMAF_SOURCE_DIR || '/root/.openclaw/workspace/projects/armaf/ad-spend-report';
const outFile = path.join(root, 'public/data/dashboard-snapshot.json');
const assetDir = path.join(root, 'public/assets/ad-images');
const organicSourceFile = process.env.ARMAF_ORGANIC_FILE || '/root/.openclaw/workspace/projects/armaf/organic-meta-report/armaf-organic-meta-data.json';
const organicMediaSource = path.join(path.dirname(organicSourceFile), 'media');
const organicMediaOut = path.join(root, 'public/assets/organic');

const reports = [
  {
    id: 'feb-mar-2026',
    label: 'Feb-Mar 2026',
    shortLabel: 'Feb-Mar',
    periodStart: '2026-02-01',
    periodEnd: '2026-03-31',
    file: 'armaf-paid-media-report-2520-38-feb-mar-2026.json',
    pdf: '/reports/armaf-paid-media-report-2520-38-feb-mar-2026.pdf'
  },
  {
    id: 'april-2026',
    label: 'April 2026',
    shortLabel: 'April',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    file: 'armaf-paid-media-report-2520-03-april-2026-v2.json',
    pdf: '/reports/armaf-paid-media-report-2520-03-april-2026-v2.pdf'
  },
  {
    id: 'may-2026',
    label: 'May 2026',
    shortLabel: 'May',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    file: 'armaf-paid-media-report-4090-00-may-2026.json',
    pdf: '/reports/armaf-paid-media-report-4090-00-may-2026.pdf'
  },
  {
    id: 'june-2026',
    label: 'June 2026',
    shortLabel: 'June',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    file: 'armaf-paid-media-report-4097-00-june-2026.json',
    pdf: '/reports/armaf-paid-media-report-4097-00-june-2026.pdf'
  }
];

function addCtr(row) {
  const impressions = Number(row.impressions || 0);
  const clicks = Number(row.clicks || 0);
  return {
    ...row,
    ctr: impressions ? (clicks / impressions) * 100 : 0
  };
}

function sumRows(rows) {
  return addCtr(rows.reduce((acc, row) => {
    acc.spend += Number(row.spend || 0);
    acc.sourceSpend += Number(row.sourceSpend || 0);
    acc.impressions += Number(row.impressions || 0);
    acc.reach += Number(row.reach || 0);
    acc.clicks += Number(row.clicks || 0);
    acc.engagements += Number(row.engagements || 0);
    return acc;
  }, { spend: 0, sourceSpend: 0, impressions: 0, reach: 0, clicks: 0, engagements: 0 }));
}

function imageMeta(creativeId) {
  const candidates = ['jpg', 'jpeg', 'png', 'webp']
    .map((ext) => path.join(assetDir, `${creativeId}.${ext}`))
    .filter((file) => fs.existsSync(file));
  if (!candidates.length) return { image: '', imageQuality: 'missing', imageBytes: 0 };
  const file = candidates.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  const bytes = fs.statSync(file).size;
  return {
    image: `/assets/ad-images/${path.basename(file)}`,
    imageQuality: bytes >= 60000 ? 'high' : bytes >= 16000 ? 'standard' : 'preview',
    imageBytes: bytes
  };
}

function cleanAd(ad, report) {
  const creativeId = String(ad.creative?.id || ad.ad_id);
  const image = imageMeta(creativeId);
  return addCtr({
    id: String(ad.ad_id || creativeId),
    creativeId,
    name: ad.ad_name || ad.name || 'Untitled ad',
    campaign: ad.campaign_name || ad.campaign || 'Campaign',
    reportId: report.id,
    reportLabel: report.label,
    reportShortLabel: report.shortLabel,
    pdf: report.pdf,
    spend: Number(ad.spend || 0),
    sourceSpend: Number(ad.sourceSpend || 0),
    impressions: Number(ad.impressions || 0),
    reach: Number(ad.reach || 0),
    clicks: Number(ad.clicks || 0),
    engagements: Number(ad.engagements || 0),
    permalink: ad.creative?.instagram_permalink_url || '',
    thumbnail: ad.creative?.thumbnail_url || '',
    ...image
  });
}

function readReport(config) {
  const raw = JSON.parse(fs.readFileSync(path.join(sourceDir, config.file), 'utf8'));
  const factor = raw.modeling?.spendFactor || 1;
  const withSourceSpend = (row) => addCtr({
    ...row,
    spend: Number(row.spend || 0),
    sourceSpend: Number(row.sourceSpend || (Number(row.spend || 0) / factor)),
    impressions: Number(row.impressions || 0),
    reach: Number(row.reach || 0),
    clicks: Number(row.clicks || 0),
    engagements: Number(row.engagements || 0)
  });

  const ads = (raw.ads || []).map((ad) => cleanAd({
    ...ad,
    sourceSpend: Number(ad.spend || 0) / factor
  }, config));

  return {
    ...config,
    total: withSourceSpend(raw.total || {}),
    campaigns: (raw.campaigns || []).map(withSourceSpend),
    monthly: (raw.monthly || []).map(withSourceSpend),
    daily: (raw.daily || []).map((row) => ({
      ...withSourceSpend(row),
      reportId: config.id,
      reportLabel: config.label
    })),
    ads,
    matchedRows: raw.matchedRows || 0
  };
}

const reportData = reports.map(readReport);
const ads = reportData.flatMap((report) => report.ads);
const totals = sumRows(reportData.map((report) => report.total));
const campaigns = Object.values(ads.reduce((acc, ad) => {
  const key = ad.campaign;
  acc[key] ||= { campaign: key, spend: 0, sourceSpend: 0, impressions: 0, reach: 0, clicks: 0, engagements: 0, ads: 0 };
  acc[key].spend += ad.spend;
  acc[key].sourceSpend += ad.sourceSpend;
  acc[key].impressions += ad.impressions;
  acc[key].reach += ad.reach;
  acc[key].clicks += ad.clicks;
  acc[key].engagements += ad.engagements;
  acc[key].ads += 1;
  return acc;
}, {})).map(addCtr).sort((a, b) => b.spend - a.spend);

function average(rows, key) {
  return rows.length ? rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length : 0;
}

function organicSnapshot() {
  if (!fs.existsSync(organicSourceFile)) return null;
  const raw = JSON.parse(fs.readFileSync(organicSourceFile, 'utf8'));
  const monthly = raw.monthly || [];
  const agencyStart = raw.source?.agency_start || '2026-02-01';
  const agencyMonth = agencyStart.slice(0, 7);
  const pre = monthly.filter((row) => row.month < agencyMonth);
  const post = monthly.filter((row) => row.month >= agencyMonth);
  const comparablePost = post.filter((row) => row.month !== '2026-07');
  const compareKeys = ['account_reach', 'account_views', 'account_total_interactions', 'profile_views', 'website_clicks', 'total_posts', 'total_engagement'];
  const comparison = Object.fromEntries(compareKeys.map((key) => {
    const before = average(pre, key);
    const after = average(comparablePost, key);
    return [key, { before, after, lift: before ? ((after / before) - 1) * 100 : null }];
  }));
  const localFiles = new Set(raw.local_media_files || []);
  fs.mkdirSync(organicMediaOut, { recursive: true });
  for (const filename of localFiles) {
    const source = path.join(organicMediaSource, filename);
    const destination = path.join(organicMediaOut, filename);
    if (fs.existsSync(source)) fs.copyFileSync(source, destination);
  }
  const media = (raw.instagram?.media || []).map((item) => {
    const filename = `ig-${item.id}.jpg`;
    return {
      id: item.id,
      caption: item.caption || '',
      type: item.media_product_type || item.media_type || 'POST',
      format: item.media_type || 'POST',
      date: item.date,
      month: item.month,
      permalink: item.permalink || '',
      image: localFiles.has(filename) ? `/assets/organic/${filename}` : '',
      reach: Number(item.insights?.reach || 0),
      views: Number(item.insights?.views || 0),
      likes: Number(item.insights?.likes || item.like_count || 0),
      comments: Number(item.insights?.comments || item.comments_count || 0),
      saves: Number(item.insights?.saved || 0),
      shares: Number(item.insights?.shares || 0),
      interactions: Number(item.insights?.total_interactions || 0)
    };
  });
  const topContent = media
    .filter((item) => item.image)
    .sort((a, b) => b.interactions - a.interactions || b.reach - a.reach)
    .slice(0, 12);
  return {
    periodStart: raw.source?.period_start,
    periodEndExclusive: raw.source?.period_until_exclusive,
    agencyStart,
    generatedAt: raw.generated_at,
    limitations: raw.source?.limitations || [],
    accounts: raw.accounts,
    monthly,
    comparison: { preMonths: pre.length, postMonths: comparablePost.length, excludesPartialJuly: true, metrics: comparison },
    totals: monthly.reduce((acc, row) => {
      for (const key of compareKeys) acc[key] = (acc[key] || 0) + Number(row[key] || 0);
      acc.ig_posts = (acc.ig_posts || 0) + Number(row.ig_posts || 0);
      acc.fb_posts = (acc.fb_posts || 0) + Number(row.fb_posts || 0);
      acc.ig_content_reach = (acc.ig_content_reach || 0) + Number(row.ig_content_reach || 0);
      acc.ig_content_views = (acc.ig_content_views || 0) + Number(row.ig_content_views || 0);
      acc.ig_total_interactions = (acc.ig_total_interactions || 0) + Number(row.ig_total_interactions || 0);
      acc.fb_engagement = (acc.fb_engagement || 0) + Number(row.fb_reactions || 0) + Number(row.fb_comments || 0) + Number(row.fb_shares || 0);
      acc.fb_clicks = (acc.fb_clicks || 0) + Number(row.fb_clicks || 0);
      return acc;
    }, {}),
    media,
    topContent
  };
}

const snapshot = {
  brand: 'Armaf USA',
  title: 'Paid Media Dashboard',
  generatedAt: new Date().toISOString(),
  source: 'bundled',
  summary: {
    reports: reportData.length,
    ads: ads.length,
    campaigns: campaigns.length,
    periods: reports.map(({ id, label, periodStart, periodEnd }) => ({ id, label, periodStart, periodEnd })),
    totals
  },
  reports: reportData,
  campaigns,
  ads,
  organicData: organicSnapshot(),
  googleAds: {
    status: 'sample',
    label: 'Illustrative campaign model',
    channel: 'Display / Banner',
    periodStart: '2026-05-01',
    periodEnd: '2026-06-30',
    campaigns: [
      { id: 'g-may-odyssey', month: '2026-05', name: 'ARMAF | DISPLAY | MAYO | ODYSSEY', theme: 'Odyssey', spend: 4680, impressions: 982400, clicks: 4821, conversions: 164, viewableRate: 72.8, sizes: ['300×250', '728×90', '160×600'] },
      { id: 'g-may-island', month: '2026-05', name: 'ARMAF | DISPLAY | MAYO | ISLAND BREEZE', theme: 'Island Breeze', spend: 3920, impressions: 846700, clicks: 3556, conversions: 119, viewableRate: 69.4, sizes: ['300×250', '320×50', '728×90'] },
      { id: 'g-may-yum', month: '2026-05', name: 'ARMAF | DISPLAY | MAYO | YUM YUM', theme: 'Yum Yum', spend: 3210, impressions: 691300, clicks: 3180, conversions: 108, viewableRate: 74.1, sizes: ['300×250', '160×600', '320×50'] },
      { id: 'g-jun-iconic', month: '2026-06', name: 'ARMAF | DISPLAY | JUNIO | CLUB DE NUIT ICONIC', theme: 'Club de Nuit Iconic', spend: 5180, impressions: 1086200, clicks: 5647, conversions: 201, viewableRate: 76.5, sizes: ['300×250', '728×90', '160×600'] },
      { id: 'g-jun-checkmate', month: '2026-06', name: 'ARMAF | DISPLAY | JUNIO | CHECKMATE KING', theme: 'Checkmate King', spend: 4360, impressions: 913500, clicks: 4476, conversions: 153, viewableRate: 73.2, sizes: ['300×250', '320×50', '728×90'] },
      { id: 'g-jun-old-money', month: '2026-06', name: 'ARMAF | DISPLAY | JUNIO | OLD MONEY', theme: 'Old Money', spend: 3970, impressions: 818900, clicks: 3767, conversions: 132, viewableRate: 71.7, sizes: ['300×250', '160×600', '320×50'] }
    ],
    sizeBenchmarks: [
      { size: '300×250', share: 38, ctr: 0.55, viewableRate: 76.4 },
      { size: '728×90', share: 24, ctr: 0.41, viewableRate: 73.8 },
      { size: '160×600', share: 21, ctr: 0.47, viewableRate: 70.2 },
      { size: '320×50', share: 17, ctr: 0.36, viewableRate: 68.9 }
    ],
    disclaimer: 'Sample campaigns and illustrative metrics for May and June 2026 only. Excluded from every live Meta and executive total.'
  }
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${outFile}`);
