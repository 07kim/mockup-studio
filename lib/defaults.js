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
  deviceScale: 1, // キャンバス内でのデバイス拡大率（§3.9）
  offsetX: 0, // 位置オフセット（キャンバス幅に対する %）
  offsetY: 0, // 位置オフセット（キャンバス高に対する %）
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
