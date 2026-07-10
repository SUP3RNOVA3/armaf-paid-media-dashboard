import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const sourceDir = process.env.ARMAF_SOURCE_DIR || '/root/.openclaw/workspace/projects/armaf/ad-spend-report';
const assetDir = path.join(root, 'public/assets/ad-images');
const reports = [
  'armaf-paid-media-report-2520-38-feb-mar-2026.json',
  'armaf-paid-media-report-2520-03-april-2026-v2.json',
  'armaf-paid-media-report-4090-00-may-2026.json',
  'armaf-paid-media-report-4097-00-june-2026.json'
];

function imagePath(creativeId) {
  return ['jpg', 'jpeg', 'png', 'webp']
    .map((ext) => path.join(assetDir, `${creativeId}.${ext}`))
    .find((file) => fs.existsSync(file));
}

function imageSize(creativeId) {
  const file = imagePath(creativeId);
  return file ? fs.statSync(file).size : 0;
}

function replaceImage(targetId, sourceFile) {
  const existing = imagePath(targetId);
  const ext = path.extname(sourceFile) || '.jpg';
  const targetFile = path.join(assetDir, `${targetId}${ext}`);
  if (existing && existing !== targetFile) fs.rmSync(existing);
  fs.copyFileSync(sourceFile, targetFile);
}

function upscalePreview(file) {
  const tmp = `${file}.tmp.jpg`;
  try {
    execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      file,
      '-vf',
      'scale=720:-1:flags=lanczos,unsharp=5:5:0.45:3:3:0.15',
      '-q:v',
      '2',
      tmp
    ]);
    if (fs.existsSync(tmp) && fs.statSync(tmp).size > fs.statSync(file).size) {
      fs.renameSync(tmp, file);
      return true;
    }
    if (fs.existsSync(tmp)) fs.rmSync(tmp);
  } catch {
    if (fs.existsSync(tmp)) fs.rmSync(tmp);
  }
  return false;
}

const groups = new Map();
const creativeIds = new Set();

for (const report of reports) {
  const data = JSON.parse(fs.readFileSync(path.join(sourceDir, report), 'utf8'));
  for (const ad of data.ads || []) {
    const creative = ad.creative || {};
    const creativeId = String(creative.id || ad.ad_id);
    creativeIds.add(creativeId);
    const groupKey = creative.instagram_permalink_url || creative.effective_object_story_id || creative.name || creativeId;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(creativeId);
  }
}

let copied = 0;
for (const ids of groups.values()) {
  const ranked = [...new Set(ids)]
    .map((id) => ({ id, file: imagePath(id), size: imageSize(id) }))
    .filter((item) => item.file)
    .sort((a, b) => b.size - a.size);
  const best = ranked[0];
  if (!best || best.size < 60000) continue;
  for (const item of ranked.slice(1)) {
    if (item.size < 60000) {
      replaceImage(item.id, best.file);
      copied += 1;
    }
  }
}

let upscaled = 0;
for (const id of creativeIds) {
  const file = imagePath(id);
  if (!file) continue;
  const size = fs.statSync(file).size;
  if (size > 0 && size < 20000 && upscalePreview(file)) upscaled += 1;
}

console.log(`Image normalization complete. copied_hq=${copied} upscaled_previews=${upscaled}`);
