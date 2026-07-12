// ============================================================================
// 検証・警告の派生計算（§3.7）。純関数。状態を汚さない。
// すべて「強制ではない気づき」。書き出しは止めない。
// ============================================================================

import { getFrame } from './devices.js';

/** 配列の最頻値と、その集計を返す。 */
function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null, bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return { value: best, count: bestN, counts };
}

/**
 * バッチのフレーム/スタイル不一致を検出（§3.7）。
 * しきい値: 3件以上で、少数派（全体の20%以下 かつ 明確に別値）を対象。
 * @returns {Array<{field:string, majority:any, itemId:number, label:string}>}
 */
export function batchMismatchWarnings(items, settings) {
  const warns = [];
  if (items.length < 3) return warns;

  // device は item ごと。style 系は現状 settings 共通なので device のみ判定。
  const fields = [{ key: 'device', get: (it) => it.device, label: 'フレーム' }];

  for (const { key, get, label } of fields) {
    const values = items.map(get);
    const m = mode(values);
    const threshold = items.length * 0.2;
    for (const it of items) {
      const v = get(it);
      if (v !== m.value) {
        const minorityCount = m.counts.get(v) || 0;
        if (minorityCount <= threshold) {
          const majLabel = key === 'device' ? getFrame(m.value).label : m.value;
          const myLabel = key === 'device' ? getFrame(v).label : v;
          warns.push({
            field: key,
            majority: m.value,
            itemId: it.id,
            label:
              `${label}: ${items.length}件中${m.count}件が ${majLabel}。` +
              `1件だけ ${myLabel} です`,
          });
        }
      }
    }
  }
  return warns;
}

/**
 * ソース品質の警告（§3.7）: 低解像度／比率不一致。
 * @param {object} item
 * @param {object} settings
 * @param {{w:number,h:number}} targetViewport フレームの viewport（HTML）/ 画像は img サイズ基準
 * @returns {Array<{itemId:number, kind:string, label:string}>}
 */
export function sourceQualityWarnings(item, settings, frame) {
  const warns = [];
  const img = item.img;
  if (!img || !img.width) return warns;

  // 低解像度: 画像がデバイス標準解像度より明らかに小さい（60%未満）ときだけ警告。
  // 標準解像度どおりの画像で誤警告しないようゆるめに判定する。
  const targetW = frame.viewport.w * 0.6;
  const targetH = frame.viewport.h * 0.6;
  if (img.width < targetW && img.height < targetH) {
    warns.push({
      itemId: item.id, kind: 'lowres',
      label: '元画像が選択解像度より小さく、拡大でぼやける恐れがあります',
    });
  }

  // 比率不一致: cover で大きくトリミング / contain で余白が目立つ見込み
  const imgAspect = img.width / img.height;
  const screenAspect = frame.viewport.w / frame.viewport.h;
  const ratio = imgAspect / screenAspect;
  if (ratio < 0.7 || ratio > 1.43) {
    warns.push({
      itemId: item.id, kind: 'aspect',
      label:
        settings.fit === 'contain'
          ? '比率差が大きく、contain で余白が目立ちます'
          : '比率差が大きく、cover で大きくトリミングされます',
    });
  }
  return warns;
}

/** 全 item のソース品質警告をまとめて算出。 */
export function allSourceWarnings(items, settings) {
  const out = [];
  for (const it of items) {
    out.push(...sourceQualityWarnings(it, settings, getFrame(it.device)));
  }
  return out;
}
