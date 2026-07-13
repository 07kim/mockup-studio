// ============================================================================
// 既定値・プリセット（§13 / §3.5）
// ============================================================================

/** 既定 Settings（§13）。 */
export const DEFAULT_SETTINGS = {
  frameStyle: 'real', // 'real' | 'minimal'
  frameColor: '#15171c',
  fit: 'cover', // 'cover' | 'contain' | 'stretch'
  screenBg: '#ffffff',
  rotX: 0,
  rotY: 0,
  thickness: 0, // 0..60
  perspTick: 40, // 0..100
  bgType: 'transparent', // 'transparent' | 'solid' | 'gradient' | 'image'
  bgColor: '#0f1115',
  gradA: '#4f46e5',
  gradB: '#ec4899',
  gradAngle: 45,
  shadow: false, // 既定はフレームぴったり（影なし・余白なし）
  shadowStr: 0.55, // 0..1
  pad: 0,
  hideNotch: false, // ノッチ / Dynamic Island を隠す（対応アセット枠のみ）
  deviceScale: 1, // キャンバス内でのデバイス拡大率（§3.9・内部用）
  offsetX: 0, // 位置オフセット（キャンバス幅に対する %・内部用）
  offsetY: 0, // 位置オフセット（キャンバス高に対する %・内部用）
  imgZoom: 1, // 画面内の画像ズーム（フレームは固定）。0.5..3
  imgX: 0, // 画面内の画像の左右位置（画面幅に対する %）
  imgY: 0, // 画面内の画像の上下位置（画面高に対する %）
  preset: 'none', // 書き出しプリセット（§8）
  format: 'png', // 'png' | 'jpg' | 'svg'
  scale: 2, // 1 | 2 | 3
  filenameTemplate: '{name}', // 既定: 元のファイル名
  nameMode: 'original', // 'original'（元の名前）| 'custom'（新しい名前）
  nameBase: '', // custom 時の共通ベース名
  nameNumber: false, // 連番をつける
  indexPad: 2,
  zipNameTemplate: 'mockups_{date}-{time}',
};

/**
 * 背景プリセット（体験の核）。サムネイルから1クリックで映える背景に。
 * type: 'transparent' | 'solid' | 'gradient'
 */
export const BG_PRESETS = [
  { id: 'none', label: 'なし', type: 'transparent' },
  { id: 'white', label: '白', type: 'solid', color: '#ffffff' },
  { id: 'light', label: 'ライト', type: 'solid', color: '#eef2f7' },
  { id: 'dark', label: 'ダーク', type: 'solid', color: '#0f172a' },
  { id: 'indigo', label: 'インディゴ', type: 'gradient', a: '#6366f1', b: '#ec4899', angle: 135 },
  { id: 'ocean', label: 'オーシャン', type: 'gradient', a: '#2563eb', b: '#06b6d4', angle: 135 },
  { id: 'sunset', label: 'サンセット', type: 'gradient', a: '#fb7185', b: '#f97316', angle: 135 },
  { id: 'mint', label: 'ミント', type: 'gradient', a: '#10b981', b: '#0ea5e9', angle: 135 },
  { id: 'grape', label: 'グレープ', type: 'gradient', a: '#7c3aed', b: '#db2777', angle: 135 },
  { id: 'peach', label: 'ピーチ', type: 'gradient', a: '#fbbf24', b: '#fb7185', angle: 135 },
  { id: 'slate', label: 'スレート', type: 'gradient', a: '#334155', b: '#0f172a', angle: 135 },
  { id: 'cloud', label: 'クラウド', type: 'gradient', a: '#e2e8f0', b: '#f8fafc', angle: 135 },
];

/** プリセット→CSS背景（サムネイル表示用）。 */
export function bgPresetCss(p) {
  if (p.type === 'gradient') return `linear-gradient(${p.angle}deg, ${p.a}, ${p.b})`;
  if (p.type === 'solid') return p.color;
  return 'none';
}

/** 現在の設定に一致するプリセット id を返す（無ければ null）。 */
export function activeBgPresetId(s) {
  if (!s.bgType || s.bgType === 'transparent') return 'none';
  for (const p of BG_PRESETS) {
    if (p.type === 'solid' && s.bgType === 'solid' && s.bgColor?.toLowerCase() === p.color.toLowerCase()) return p.id;
    if (p.type === 'gradient' && s.bgType === 'gradient'
      && s.gradA?.toLowerCase() === p.a.toLowerCase() && s.gradB?.toLowerCase() === p.b.toLowerCase() && s.gradAngle === p.angle) return p.id;
  }
  return null;
}

/**
 * クイックスタイル：端末はそのままに、背景・影・余白・角度を一括適用して
 * 1クリックで「映える作品」に。thumb はサムネイル表示用のCSS背景。
 */
export const QUICK_STYLES = [
  { id: 'plain', label: 'プレーン', thumb: '#eef2f7',
    patch: { bgType: 'transparent', shadow: false, pad: 0, rotX: 0, rotY: 0, thickness: 0 } },
  { id: 'shadow', label: '影付き', thumb: '#e7ebf1',
    patch: { bgType: 'transparent', shadow: true, shadowStr: 0.5, pad: 90, rotX: 0, rotY: 0, thickness: 0 } },
  { id: 'grad', label: 'グラデ', thumb: 'linear-gradient(135deg,#6366f1,#ec4899)',
    patch: { bgType: 'gradient', gradA: '#6366f1', gradB: '#ec4899', gradAngle: 135, shadow: true, shadowStr: 0.4, pad: 120, rotX: 0, rotY: 0, thickness: 0 } },
  { id: 'iso', label: 'アイソメ', thumb: 'linear-gradient(135deg,#2563eb,#06b6d4)',
    patch: { bgType: 'gradient', gradA: '#2563eb', gradB: '#06b6d4', gradAngle: 135, shadow: true, shadowStr: 0.4, pad: 120, rotY: -20, rotX: 14, thickness: 24, perspTick: 28 } },
  { id: 'dark', label: 'ダーク', thumb: '#0f172a',
    patch: { bgType: 'solid', bgColor: '#0f172a', shadow: true, shadowStr: 0.5, pad: 120, rotX: 0, rotY: 0, thickness: 0 } },
  { id: 'mint', label: 'ミント', thumb: 'linear-gradient(135deg,#10b981,#0ea5e9)',
    patch: { bgType: 'gradient', gradA: '#10b981', gradB: '#0ea5e9', gradAngle: 135, shadow: true, shadowStr: 0.4, pad: 120, rotX: 0, rotY: 0, thickness: 0 } },
];

/** 名前付きフレームカラー・プリセット（§3.5）。 */
export const COLOR_PRESETS = [
  { name: 'ブラック', color: '#15171c' },
  { name: 'シルバー', color: '#e3e4e6' },
  { name: 'ネイビー', color: '#2f4a6b' },
  { name: 'ゴールド', color: '#f4e2c9' },
  { name: 'パープル', color: '#5b4a7a' },
  { name: 'レッド', color: '#8a2b2b' },
];

const STORAGE_KEY = 'mockup-studio.settings.v2';

/** localStorage から設定を復元（§4.1 記憶より認識）。 */
export function loadSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** localStorage に設定を保存。 */
export function saveSettings(settings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* 保存失敗は無視 */
  }
}
