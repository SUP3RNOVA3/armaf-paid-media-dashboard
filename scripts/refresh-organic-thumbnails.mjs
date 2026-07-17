import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const API = 'https://graph.facebook.com/v23.0';
const sourceFile = process.env.ARMAF_ORGANIC_FILE || path.resolve(process.cwd(), '../organic-meta-report/armaf-organic-meta-data.json');
const outDir = path.resolve(process.cwd(), 'public/assets/organic-thumbs');

function loadInfisicalEnv() {
  const file = path.join(os.homedir(), '.clawdbot/secrets/infisical.env');
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

async function metaToken() {
  loadInfisicalEnv();
  const url = new URL('/api/v3/secrets/raw', process.env.INFISICAL_URL);
  url.searchParams.set('workspaceId', process.env.INFISICAL_PROJECT_ID);
  url.searchParams.set('environment', 'prod');
  url.searchParams.set('secretPath', '/SOCIAL/META');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.INFISICAL_TOKEN}` } });
  const payload = await response.json();
  const secret = (payload.secrets || []).find((item) => item.secretKey === 'META_BUSINESSMANAGER_SYSTEM_USER_TOKEN');
  if (!response.ok || !secret) throw new Error('Could not load Meta token');
  return secret.secretValue;
}

async function freshMediaUrl(id, token) {
  const url = new URL(`${API}/${id}`);
  url.searchParams.set('fields', 'media_type,media_url,thumbnail_url');
  url.searchParams.set('access_token', token);
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) return '';
  return payload.media_type === 'VIDEO' ? payload.thumbnail_url : payload.media_url;
}

async function fetchBuffer(url) {
  if (!url) return null;
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!response.ok || !(response.headers.get('content-type') || '').startsWith('image/')) return null;
  return Buffer.from(await response.arrayBuffer());
}

const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const media = source.instagram?.media || [];
const token = await metaToken();
fs.mkdirSync(outDir, { recursive: true });
let created = 0;
let kept = 0;
let missing = 0;

for (const [index, item] of media.entries()) {
  const output = path.join(outDir, `ig-${item.id}.webp`);
  if (fs.existsSync(output) && fs.statSync(output).size > 1500) {
    kept += 1;
    continue;
  }
  let buffer = await fetchBuffer(item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url);
  if (!buffer) buffer = await fetchBuffer(await freshMediaUrl(item.id, token));
  if (!buffer) {
    missing += 1;
    console.warn(`${index + 1}/${media.length} ${item.id}: unavailable`);
    continue;
  }
  await sharp(buffer).resize(160, 160, { fit: 'cover', position: 'attention' }).webp({ quality: 78 }).toFile(output);
  created += 1;
  if ((index + 1) % 25 === 0) console.log(`${index + 1}/${media.length}`);
  await new Promise((resolve) => setTimeout(resolve, 80));
}

console.log({ total: media.length, created, kept, missing });
