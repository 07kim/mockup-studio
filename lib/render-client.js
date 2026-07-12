// ============================================================================
// HTML アイテムのクライアント側レンダリング（/api/render 呼び出し）§3.4 / §5.1
// ============================================================================

import { getFrame } from './devices.js';

// 任意アプリトークン（§9）。ページを開いた人には自動付与、ボット直叩きを弾く。
const APP_TOKEN = process.env.NEXT_PUBLIC_APP_TOKEN || '';
function authHeaders(extra = {}) {
  return APP_TOKEN ? { ...extra, 'x-app-token': APP_TOKEN } : extra;
}

/** frame + orientation から HTML レンダリング用ビューポートを算出。 */
export function viewportFor(device, orientation) {
  const frame = getFrame(device);
  const { w, h } = frame.viewport;
  if (frame.canRotate && orientation === 'landscape') return { w: h, h: w };
  return { w, h };
}

/** Blob → HTMLImageElement（デコード完了まで待つ）。 */
export function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像のデコードに失敗しました')); };
    img.src = url;
  });
}

/**
 * HTML item（url / folder）を指定デバイスの viewport でレンダリングし、
 * 得られた PNG を HTMLImageElement にして返す。
 * @param {object} item  { source, device, orientation, renderOpts }
 * @returns {Promise<HTMLImageElement>}
 */
export async function renderHtmlItem(item) {
  const vp = viewportFor(item.device, item.orientation);
  const src = item.source;
  let res;

  if (src.type === 'url') {
    const ro = item.renderOpts || {};
    res = await fetch('/api/render', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        url: src.url,
        width: vp.w,
        height: vp.h,
        waitMs: ro.waitMs || 0,
        fullPage: !!ro.fullPage,
        selector: ro.selector || null,
        scrollX: ro.scrollX || 0,
        scrollY: ro.scrollY || 0,
        emulate: typeof ro.emulate === 'string' ? { colorScheme: ro.emulate } : (ro.emulate || {}),
      }),
    });
  } else if (src.type === 'folder') {
    const fd = new FormData();
    fd.append('entry', src.entry || 'index.html');
    fd.append('width', String(vp.w));
    fd.append('height', String(vp.h));
    if (item.renderOpts?.fullPage) fd.append('fullPage', 'true');
    if (item.renderOpts?.waitMs) fd.append('waitMs', String(item.renderOpts.waitMs));
    if (item.renderOpts?.selector) fd.append('selector', item.renderOpts.selector);
    if (item.renderOpts?.emulate) fd.append('emulate', JSON.stringify({ colorScheme: item.renderOpts.emulate }));
    for (const f of src.files) {
      fd.append('files', f.file, f.path);
      fd.append('paths', f.path);
    }
    res = await fetch('/api/render', { method: 'POST', headers: authHeaders(), body: fd });
  } else {
    throw new Error('未対応のソースです');
  }

  if (!res.ok) {
    let msg = `レンダリング失敗 (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  return blobToImage(blob);
}
