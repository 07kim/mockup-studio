// ============================================================================
// 書き出しプリセット（§8 / §3.9）: 指定ピクセルに収める出力サイズ
// ============================================================================

export const EXPORT_PRESETS = [
  { id: 'none', label: '原寸（プリセットなし）', w: 0, h: 0 },
  { id: 'appstore-6.9', label: 'App Store 6.9" (1320×2868)', w: 1320, h: 2868 },
  { id: 'appstore-6.5', label: 'App Store 6.5" (1242×2688)', w: 1242, h: 2688 },
  { id: 'appstore-5.5', label: 'App Store 5.5" (1242×2208)', w: 1242, h: 2208 },
  { id: 'ipad-12.9', label: 'iPad 12.9" (2048×2732)', w: 2048, h: 2732 },
  { id: 'ogp', label: 'OGP (1200×630)', w: 1200, h: 630 },
  { id: 'x', label: 'X / Twitter (1600×900)', w: 1600, h: 900 },
  { id: 'ig-square', label: 'Instagram 正方形 (1080×1080)', w: 1080, h: 1080 },
  { id: 'ig-portrait', label: 'Instagram 縦 (1080×1350)', w: 1080, h: 1350 },
];

const MAP = new Map(EXPORT_PRESETS.map((p) => [p.id, p]));

/** id からプリセットを取得。 */
export function getPreset(id) {
  return MAP.get(id) || EXPORT_PRESETS[0];
}
