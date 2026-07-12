// ============================================================================
// プロジェクト保存/読込（.mockupproj ZIP・§5.5）
// 画像は ZIP に同梱（base64 ではなくバイナリ）。URL 系は source を保持し復元時に再利用可。
// ============================================================================

import JSZip from 'jszip';
import { blobToImage } from './render-client.js';
import { readRaw, importJson } from './customFrames.js';

const VERSION = 1;

/** HTMLImageElement → PNG Blob */
function imgToBlob(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

/**
 * プロジェクトを ZIP Blob に保存。
 * @returns {Promise<Blob>}
 */
export async function saveProject(items, settings, bgImg, overrides = {}) {
  const zip = new JSZip();
  const meta = [];
  for (const it of items) {
    // folder の File 群は保存対象外（source type のみ保持）
    const source = it.source
      ? (it.source.type === 'folder' ? { type: 'folder', entry: it.source.entry } : it.source)
      : undefined;
    meta.push({
      id: it.id, kind: it.kind, name: it.name, device: it.device,
      orientation: it.orientation, source, renderOpts: it.renderOpts, hasImage: !!it.img,
    });
    if (it.img) zip.file(`images/${it.id}.png`, await imgToBlob(it.img));
  }
  if (bgImg) zip.file('bg.png', await imgToBlob(bgImg));

  const manifest = {
    version: VERSION,
    settings,
    items: meta,
    overrides,
    customFrames: readRaw(),
    hasBg: !!bgImg,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob' });
}

/**
 * プロジェクトを読込。items は id 未割当（呼び出し側で採番）。
 * @returns {Promise<{items:Array, settings:object, bgImg:HTMLImageElement|null}>}
 */
export async function loadProject(file) {
  const zip = await JSZip.loadAsync(file);
  const mf = zip.file('manifest.json');
  if (!mf) throw new Error('manifest.json が見つかりません');
  const manifest = JSON.parse(await mf.async('string'));

  // カスタムフレームを登録（マージ）
  if (manifest.customFrames?.length) {
    try { await importJson(JSON.stringify(manifest.customFrames)); } catch {}
  }

  const items = [];
  for (const m of manifest.items) {
    let img = null;
    const f = zip.file(`images/${m.id}.png`);
    if (f) { try { img = await blobToImage(await f.async('blob')); } catch {} }
    items.push({
      _oldId: m.id,
      kind: m.kind, name: m.name, device: m.device, orientation: m.orientation,
      source: m.source, renderOpts: m.renderOpts, img,
      error: m.kind === 'html' && m.source?.type === 'folder' && !img ? 'フォルダは再取込が必要です' : null,
    });
  }

  let bgImg = null;
  if (manifest.hasBg) {
    const bf = zip.file('bg.png');
    if (bf) { try { bgImg = await blobToImage(await bf.async('blob')); } catch {} }
  }

  return { items, settings: manifest.settings, bgImg, overrides: manifest.overrides || {} };
}
