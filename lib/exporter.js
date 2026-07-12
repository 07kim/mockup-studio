// ============================================================================
// 書き出しオーケストレーション（§3.6 / §3.8）
// 1件はそのまま、2件以上は ZIP。進捗コールバックあり。UI を止めない逐次処理。
// ============================================================================

import JSZip from 'jszip';
import { renderItem, canvasToBlob, wrapToSize } from './engine.js';
import { expandTemplate, dedupeNames, withExt } from './filename.js';
import { getPreset } from './presets.js';

const EXPORT_N = 28; // 書き出し時のワープ格子（§7）
const MAX_EDGE = 16000; // canvas 最大辺クランプ（§13）

/** 現在時刻から date/time トークン用文字列を生成。 */
export function nowTokens(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`,
    time: `${p(d.getHours())}${p(d.getMinutes())}`,
  };
}

/**
 * scale をクランプ: 出力最大辺が MAX_EDGE を超えるなら scale を自動降格。
 * @returns {{scale:number, downgraded:boolean}}
 */
function clampScale(item, settings, bgImg) {
  let scale = settings.scale || 2;
  let downgraded = false;
  // 概算: フレーム base 相当 × scale で判定するため 1x で試算
  while (scale > 1) {
    const test = renderItem(item, { ...settings, scale }, scale, 4, bgImg);
    if (Math.max(test.width, test.height) <= MAX_EDGE) break;
    scale -= 1;
    downgraded = true;
  }
  return { scale, downgraded };
}

/**
 * 指定 item 群を書き出し。
 * @param {object[]} items  書き出す item
 * @param {object} settings
 * @param {HTMLImageElement|null} bgImg
 * @param {(done:number,total:number)=>void} onProgress
 * @returns {Promise<{blob:Blob, filename:string, single:boolean, downgraded:boolean}>}
 */
export async function exportItems(items, settings, bgImg, onProgress, resolveSettings) {
  const { date, time } = nowTokens();
  const total = items.length;
  let downgradedAny = false;
  const stOf = (item) => (resolveSettings ? resolveSettings(item) : settings);

  // ファイル名を先に決定（連番→一意化）
  const bases = items.map((item, i) => {
    const st = stOf(item);
    return expandTemplate(st.filenameTemplate || '{name}_{device}{_orient}@{scale}x', {
      item, settings: st, index: i + 1, indexPad: st.indexPad || 2,
      date, time, format: st.format, scale: st.scale,
    });
  });
  const unique = dedupeNames(bases);

  const rendered = [];
  for (let i = 0; i < items.length; i++) {
    const st = stOf(items[i]);
    const { scale, downgraded } = clampScale(items[i], st, bgImg);
    if (downgraded) downgradedAny = true;
    let canvas = renderItem(items[i], { ...st, scale }, scale, EXPORT_N, bgImg);
    // 書き出しプリセット（指定サイズに収める・§8）
    const preset = getPreset(st.preset || 'none');
    if (preset.w && preset.h) canvas = wrapToSize(canvas, preset.w, preset.h, st, bgImg);
    const blob = await canvasToBlob(canvas, st.format || 'png');
    rendered.push({ blob, filename: withExt(unique[i], st.format) });
    onProgress?.(i + 1, total);
    // メモリ解放の猶予（UI ブロック回避）
    await new Promise((r) => setTimeout(r, 0));
  }

  if (rendered.length === 1) {
    return { blob: rendered[0].blob, filename: rendered[0].filename, single: true, downgraded: downgradedAny };
  }

  // ZIP
  const zip = new JSZip();
  for (const r of rendered) zip.file(r.filename, r.blob);
  const zipBase = expandTemplate(settings.zipNameTemplate || 'mockups_{date}-{time}', {
    item: { name: 'mockups', device: '', orientation: 'portrait' }, settings, date, time,
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, filename: `${zipBase}.zip`, single: false, downgraded: downgradedAny };
}

/** Blob をダウンロード（ブラウザ）。 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
