// ============================================================================
// 自動デバイス判定（§3.2）
// まず解像度マッチ（±3%・回転許容）→ 無ければ比率ヒューリスティック。
// ============================================================================

import { RESOLUTION_MAP } from './devices.js';

const TOL = 0.03; // ±3%

function within(a, b, tol) {
  if (b === 0) return a === 0;
  return Math.abs(a - b) / b <= tol;
}

/**
 * 解像度から device と orientation を判定。
 * @returns {{device:string, orientation:'portrait'|'landscape', matched:boolean}}
 */
export function detectDevice(width, height) {
  const landscape = width > height;
  // 比較は portrait 正規化（短辺×長辺）
  const w = Math.min(width, height);
  const h = Math.max(width, height);

  // --- 解像度マッチ ---
  for (const { device, sizes } of RESOLUTION_MAP) {
    for (const [sw, sh] of sizes) {
      if (within(w, sw, TOL) && within(h, sh, TOL)) {
        return { device, orientation: landscape ? 'landscape' : 'portrait', matched: true };
      }
    }
  }

  // --- 比率ヒューリスティック ---
  const aspect = width / height;
  let device;
  let orientation = landscape ? 'landscape' : 'portrait';

  if (aspect > 1) {
    // 横長
    if (aspect >= 1.9) device = 'iphone-island'; // phone 横向き
    else if (aspect >= 1.15) device = 'browser'; // desktop / browser
    else device = 'ipad'; // tablet 横
  } else {
    // 縦長（aspect <= 1）
    if (aspect <= 0.7) device = 'iphone-island';
    else if (aspect <= 0.9) device = 'ipad';
    else device = 'ipad'; // ほぼ正方 → tablet
  }

  return { device, orientation, matched: false };
}
