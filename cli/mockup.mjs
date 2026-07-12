#!/usr/bin/env node
// ============================================================================
// Mockup Studio CLI（§8 / §10 P8）
// mockup.config.json から sources × device × style を一括生成。
//   node cli/mockup.mjs [config.json]
// ============================================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { setCanvasFactory, renderItem, wrapToSize } from '../lib/engine.js';
import { getFrame } from '../lib/devices.js';
import { getPreset } from '../lib/presets.js';
import { expandTemplate, dedupeNames, withExt } from '../lib/filename.js';
import { renderToPng, contentTypeFor } from '../lib/folder-render.js';

// 既定スタイル（ブラウザ版 defaults と同等の最小セット）
const DEFAULT_STYLE = {
  frameStyle: 'real', frameColor: '#15171c', fit: 'cover', screenBg: '#ffffff',
  rotX: 0, rotY: 0, thickness: 0, perspTick: 40,
  bgType: 'transparent', bgColor: '#0f1115', gradA: '#4f46e5', gradB: '#ec4899', gradAngle: 45,
  shadow: true, shadowStr: 0.55, pad: 40, preset: 'none', format: 'png', scale: 2,
  filenameTemplate: '{name}_{device}{_orient}@{scale}x', indexPad: 2,
};

// @napi-rs/canvas を engine に注入
setCanvasFactory((w, h) => createCanvas(w, h));

function log(...a) { console.log('[mockup]', ...a); }

/** バッファ → napi Image（loadImage で確実にデコード） */
async function bufferToImage(buf) {
  return loadImage(buf);
}

/** フォルダを読み込み filesMap を作成 */
async function readFolder(dir) {
  const { readdir } = await import('node:fs/promises');
  const map = new Map();
  async function walk(cur, rel) {
    const entries = await readdir(cur, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(cur, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(abs, r);
      else map.set(r, { bytes: await readFile(abs), contentType: contentTypeFor(r) });
    }
  }
  await walk(dir, '');
  return map;
}

async function main() {
  const configPath = process.argv[2] || 'mockup.config.json';
  if (!existsSync(configPath)) {
    console.error(`設定ファイルが見つかりません: ${configPath}`);
    console.error('例: { "out": "out", "style": {}, "sources": [ { "image": "a.png", "device": "iphone-island" } ] }');
    process.exit(1);
  }
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const baseDir = path.dirname(path.resolve(configPath));
  const outDir = path.resolve(baseDir, config.out || 'out');
  await mkdir(outDir, { recursive: true });

  const settings = { ...DEFAULT_STYLE, ...(config.style || {}) };
  const sources = config.sources || [];
  if (!sources.length) { console.error('sources が空です'); process.exit(1); }

  // item 化
  const items = [];
  for (const s of sources) {
    const device = s.device || 'iphone-island';
    const orientation = s.orientation || 'portrait';
    const frame = getFrame(device);
    let img;
    let name = s.name;

    if (s.image) {
      img = await loadImage(path.resolve(baseDir, s.image));
      name = name || path.basename(s.image).replace(/\.[a-z0-9]+$/i, '');
    } else if (s.url || s.folder) {
      const vp = frame.canRotate && orientation === 'landscape'
        ? { w: frame.viewport.h, h: frame.viewport.w }
        : { w: frame.viewport.w, h: frame.viewport.h };
      log(`レンダリング中: ${s.url || s.folder} @ ${vp.w}x${vp.h}`);
      const buf = s.url
        ? await renderToPng({ mode: 'url', url: s.url, width: vp.w, height: vp.h, ...(s.renderOpts || {}) })
        : await renderToPng({ mode: 'folder', entry: s.entry || 'index.html', filesMap: await readFolder(path.resolve(baseDir, s.folder)), width: vp.w, height: vp.h, ...(s.renderOpts || {}) });
      img = await bufferToImage(buf);
      name = name || (s.url ? new URL(s.url).hostname.replace(/^www\./, '') : path.basename(s.folder));
    } else {
      console.warn('スキップ（image/url/folder いずれも無し）:', JSON.stringify(s));
      continue;
    }
    items.push({ kind: s.url || s.folder ? 'html' : 'image', name, img, device, orientation, itemSettings: s.style });
  }

  // ファイル名
  const bases = items.map((it, i) => expandTemplate(settings.filenameTemplate, {
    item: it, settings: { ...settings, ...(it.itemSettings || {}) }, index: i + 1,
    indexPad: settings.indexPad, format: settings.format, scale: settings.scale,
  }));
  const names = dedupeNames(bases);

  // レンダリング＆書き出し
  let n = 0;
  for (let i = 0; i < items.length; i++) {
    const st = { ...settings, ...(items[i].itemSettings || {}) };
    let canvas = renderItem(items[i], st, st.scale, 28, null);
    const preset = getPreset(st.preset || 'none');
    if (preset.w && preset.h) canvas = wrapToSize(canvas, preset.w, preset.h, st, null);
    const outPath = path.join(outDir, withExt(names[i], st.format));
    const buf = st.format === 'jpg' || st.format === 'jpeg'
      ? await canvas.encode('jpeg', 92)
      : await canvas.encode('png');
    await writeFile(outPath, buf);
    log(`書き出し: ${path.relative(process.cwd(), outPath)}`);
    n++;
  }

  log(`完了: ${n}件を ${path.relative(process.cwd(), outDir)} に生成しました`);
  process.exit(0);
}

main().catch((e) => { console.error('エラー:', e.message); process.exit(1); });
