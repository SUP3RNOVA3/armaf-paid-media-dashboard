import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = process.env.ARMAF_SOURCE_DIR || '/root/.openclaw/workspace/projects/armaf/ad-spend-report';
const outFile = path.join(root, 'public/data/dashboard-snapshot.json');
const assetDir = path.join(root, 'public/assets/ad-images');

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
  ads
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${outFile}`);
