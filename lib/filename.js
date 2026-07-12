// ============================================================================
// ファイル名テンプレート展開・サニタイズ・連番衝突回避（§3.6.1）
// ============================================================================

import { getFrame } from './devices.js';

/** '2026-07-11' 等の日付文字列を渡す前提。now は呼び出し側で生成し依存を注入する。 */

/** サニタイズ: 拡張子除去→禁止文字を'-'→60字上限。空なら'mockup'。 */
export function sanitize(name) {
  let s = String(name || '').trim();
  s = s.replace(/\.[a-z0-9]{1,5}$/i, ''); // 末尾拡張子除去
  s = s.replace(/[\/\\?#:%\s]+/g, '-');
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
  s = s.slice(0, 60);
  return s || 'mockup';
}

function pad(num, width) {
  return String(num).padStart(Math.max(1, width | 0), '0');
}

/**
 * トークンを展開してファイル名（拡張子なし）を返す。
 * @param {string} template  例 '{name}_{device}{_orient}@{scale}x'
 * @param {object} ctx  展開コンテキスト
 *   { item, settings, index, indexPad, date, time, format, scale, deviceLabel }
 */
export function expandTemplate(template, ctx) {
  const { item, settings, index = 1, indexPad = 2, date = '', time = '', format, scale } = ctx;
  const frame = getFrame(item.device);
  const orient = item.orientation === 'landscape' ? '_yoko' : '';

  const tokens = {
    name: item.name || 'mockup',
    device: item.device,
    deviceLabel: frame.label,
    orient,
    scale: String(scale ?? settings.scale ?? 2),
    index: pad(index, indexPad),
    date,
    time,
    w: '', h: '', // レンダー後に埋める場合用（未使用時は空）
    format: format ?? settings.format ?? 'png',
    color: (settings.frameColor || '').replace('#', ''),
  };

  // {index:3} のような桁数指定に対応
  let out = template.replace(/\{index(?::(\d+))?\}/g, (_, digits) =>
    pad(index, digits ? parseInt(digits, 10) : indexPad));

  // {_orient} は landscape 以外では空（区切りの'_'ごと消す）
  out = out.replace(/\{_orient\}/g, orient);

  out = out.replace(/\{(\w+)\}/g, (m, key) => (key in tokens ? tokens[key] : m));

  return sanitize(out);
}

/**
 * バッチ内で一意化: 重複したベース名に -2, -3 ... を付す。
 * @param {string[]} names サニタイズ済みのベース名配列（順序＝出力順）
 * @returns {string[]} 一意化した配列
 */
export function dedupeNames(names) {
  const seen = new Map();
  return names.map((name) => {
    const count = seen.get(name) || 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name}-${count + 1}`;
  });
}

/** 拡張子を付与。 */
export function withExt(base, format) {
  const ext = format === 'jpg' || format === 'jpeg' ? 'jpg' : format === 'svg' ? 'svg' : 'png';
  return `${base}.${ext}`;
}
