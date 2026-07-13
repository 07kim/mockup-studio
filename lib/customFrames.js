// ============================================================================
// ユーザー定義（アセット型）フレームの保存・読込（§3.10 / §5.3）
// localStorage に dataURL 同梱で保存。読込時に画像をデコードして登録。
// ============================================================================

import { registerCustomFrames, FRAMES } from './devices.js';

const KEY = 'mockup-studio.customFrames.v1';

/** dataURL → HTMLImageElement */
function decode(dataUrl) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('フレーム画像のデコードに失敗'));
    img.src = dataUrl;
  });
}

/**
 * ビルトインのアセット型フレーム（baseImageUrl 指定）の枠画像をデコードし、
 * 各 FrameDef に _baseImg を直接載せる（FRAMES はモジュール singleton なので
 * getFrame() が返す同じオブジェクトに反映される）。クライアント起動時に一度呼ぶ。
 */
export async function loadBuiltinAssetFrames() {
  if (typeof window === 'undefined') return;
  for (const f of FRAMES) {
    if (f.kind === 'asset' && f.asset?.baseImageUrl && !f._baseImg) {
      try { f._baseImg = await decode(f.asset.baseImageUrl); } catch { /* 失敗時は枠なしで描画 */ }
    }
    if (f.kind === 'asset' && f.asset?.overlayImageUrl && !f._overlayImg) {
      try { f._overlayImg = await decode(f.asset.overlayImageUrl); } catch { /* overlay 無しで描画 */ }
    }
  }
}

/** 保存済みフレーム定義（生 JSON・dataURL 入り）を取得。 */
export function readRaw() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function writeRaw(list) {
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

/**
 * 保存済みフレームを読み込み、画像をデコードして devices レジストリに登録。
 * @returns {Promise<Array>} 登録済みフレーム（_baseImg 付き）
 */
export async function loadAndRegister() {
  const raw = readRaw();
  const frames = [];
  for (const f of raw) {
    try {
      if (f.kind === 'programmatic') {
        // パラメータで作ったフレーム（ベクター・色替え可）。画像デコード不要。
        frames.push(f);
        continue;
      }
      const _baseImg = await decode(f.asset.baseImage);
      const _overlayImg = f.asset.overlayImage ? await decode(f.asset.overlayImage) : null;
      frames.push({ ...f, _baseImg, _overlayImg });
    } catch {
      /* 壊れた定義はスキップ */
    }
  }
  registerCustomFrames(frames);
  return frames;
}

/** フレームを追加/更新して保存＋再登録。 */
export async function saveFrame(def) {
  const raw = readRaw().filter((f) => f.id !== def.id);
  raw.push(def);
  writeRaw(raw);
  return loadAndRegister();
}

/** フレームを削除。 */
export async function deleteFrame(id) {
  writeRaw(readRaw().filter((f) => f.id !== id));
  return loadAndRegister();
}

/** JSON エクスポート（dataURL 同梱・そのまま配布可）。 */
export function exportJson() {
  return JSON.stringify(readRaw(), null, 2);
}

/** JSON インポート（マージ）。 */
export async function importJson(text) {
  const incoming = JSON.parse(text);
  const raw = readRaw();
  const map = new Map(raw.map((f) => [f.id, f]));
  for (const f of incoming) map.set(f.id, f);
  writeRaw([...map.values()]);
  return loadAndRegister();
}
