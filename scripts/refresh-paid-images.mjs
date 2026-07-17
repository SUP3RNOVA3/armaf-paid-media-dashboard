import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const API = 'https://graph.facebook.com/v23.0';
const root = process.cwd();
const reportDir = path.resolve(root, '../ad-spend-report');
const assetDir = path.join(root, 'public/assets/ad-images');
const reportFiles = [
  'armaf-paid-media-report-2520-38-feb-mar-2026.json',
  'armaf-paid-media-report-2520-03-april-2026-v2.json',
  'armaf-paid-media-report-4090-00-may-2026.json',
  'armaf-paid-media-report-4097-00-june-2026.json'
];

function loadInfisicalEnv() {
  const file = path.join(os.homedir(), '.clawdbot/secrets/infisical.env');
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

async function getMetaToken() {
  loadInfisicalEnv();
  const url = new URL('/api/v3/secrets/raw', process.env.INFISICAL_URL);
  url.searchParams.set('workspaceId', process.env.INFISICAL_PROJECT_ID);
  url.searchParams.set('environment', 'prod');
  url.searchParams.set('secretPath', '/SOCIAL/META');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.INFISICAL_TOKEN}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Infisical returned ${response.status}`);
  const secret = (payload.secrets || []).find((item) => item.secretKey === 'META_BUSINESSMANAGER_SYSTEM_USER_TOKEN');
  if (!secret) throw new Error('Meta system-user token not found');
  return secret.secretValue;
}

async function graph(id, fields, token) {
  const url = new URL(`${API}/${id}`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('access_token', token);
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(`${id}: ${payload.error?.message || response.status}`);
  return payload;
}

async function pageToken(systemToken) {
  const accounts = await graph('me/accounts', 'id,access_token', systemToken);
  return (accounts.data || []).find((account) => account.id === '104126481654771')?.access_token || systemToken;
}

async function candidateUrls(creativeId, token, pageAccessToken) {
  const creative = await graph(creativeId, 'image_url,thumbnail_url,object_story_spec,asset_feed_spec,effective_object_story_id', token);
  const candidates = [];
  if (creative.image_url) candidates.push({ url: creative.image_url, score: 4000, source: 'creative image' });
  for (const image of creative.asset_feed_spec?.images || []) {
    if (image.url) candidates.push({ url: image.url, score: 3900, source: 'placement image' });
  }
  for (const video of creative.asset_feed_spec?.videos || []) {
    if (!video.video_id) continue;
    try {
      const detail = await graph(video.video_id, 'thumbnails', token);
      for (const thumbnail of detail.thumbnails?.data || []) {
        candidates.push({
          url: thumbnail.uri,
          score: Number(thumbnail.width || 0) * Number(thumbnail.height || 0) + (thumbnail.is_preferred ? 100000 : 0),
          source: 'video delivery frame'
        });
      }
    } catch (error) {
      console.warn(`Video ${video.video_id}: ${error.message}`);
    }
  }
  const storyVideo = creative.object_story_spec?.video_data?.video_id;
  if (storyVideo) {
    try {
      const detail = await graph(storyVideo, 'thumbnails', token);
      for (const thumbnail of detail.thumbnails?.data || []) {
        candidates.push({ url: thumbnail.uri, score: Number(thumbnail.width || 0) * Number(thumbnail.height || 0) + 90000, source: 'story video frame' });
      }
    } catch (_) {
      // Some legacy videos are no longer queryable.
    }
  }
  if (creative.effective_object_story_id) {
    try {
      const story = await graph(creative.effective_object_story_id, 'full_picture,attachments{media,type,target,url,subattachments}', pageAccessToken);
      const collectAttachmentImages = (node) => {
        if (!node || typeof node !== 'object') return;
        if (node.media?.image?.src) {
          const width = Number(node.media.image.width || 0);
          const height = Number(node.media.image.height || 0);
          candidates.push({ url: node.media.image.src, score: width * height + 200000, source: 'story attachment' });
        }
        for (const child of node.subattachments?.data || []) collectAttachmentImages(child);
      };
      for (const attachment of story.attachments?.data || []) collectAttachmentImages(attachment);
      if (story.full_picture) candidates.push({ url: story.full_picture, score: 3600, source: 'story full picture' });
    } catch (_) {
      // Dark posts do not always expose story media to the system user.
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

async function downloadBest(creativeId, token, pageAccessToken) {
  const candidates = await candidateUrls(creativeId, token, pageAccessToken);
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!response.ok) continue;
      const type = response.headers.get('content-type') || '';
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!type.startsWith('image/') || buffer.length < 16000) continue;
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
      const existing = ['jpg', 'jpeg', 'png', 'webp'].map((item) => path.join(assetDir, `${creativeId}.${item}`)).filter(fs.existsSync);
      const currentBytes = Math.max(0, ...existing.map((file) => fs.statSync(file).size));
      const currentFile = existing.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
      const candidateSharpness = (await sharp(buffer).greyscale().stats()).sharpness;
      const currentSharpness = currentFile ? (await sharp(currentFile).greyscale().stats()).sharpness : 0;
      const materiallySharper = candidateSharpness > currentSharpness * 1.2;
      if (buffer.length <= currentBytes * 1.05 && !materiallySharper) return { status: 'kept', bytes: currentBytes, source: candidate.source };
      for (const file of existing) fs.unlinkSync(file);
      fs.writeFileSync(path.join(assetDir, `${creativeId}.${ext}`), buffer);
      return { status: 'upgraded', bytes: buffer.length, source: candidate.source };
    } catch (_) {
      // Try the next authenticated delivery asset.
    }
  }
  return { status: 'unavailable', bytes: 0, source: 'Meta preview only' };
}

const reports = reportFiles.map((file) => JSON.parse(fs.readFileSync(path.join(reportDir, file), 'utf8')));
const creativeIds = [...new Set(reports.flatMap((report) => report.ads || []).map((ad) => String(ad.creative?.id || '')).filter(Boolean))];
const token = await getMetaToken();
const pageAccessToken = await pageToken(token);
fs.mkdirSync(assetDir, { recursive: true });
const summary = { upgraded: 0, kept: 0, unavailable: 0 };
for (const [index, creativeId] of creativeIds.entries()) {
  try {
    const result = await downloadBest(creativeId, token, pageAccessToken);
    summary[result.status] += 1;
    console.log(`${index + 1}/${creativeIds.length} ${creativeId}: ${result.status} (${result.bytes} bytes, ${result.source})`);
  } catch (error) {
    summary.unavailable += 1;
    console.warn(`${creativeId}: ${error.message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 120));
}
console.log(summary);
