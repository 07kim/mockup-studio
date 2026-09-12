// ============================================================================
// FrameDef 一覧（§5.3）＋ viewport（HTMLレンダリング解像度）＋ 実解像度マップ（§3.2）
// プログラム型フレームの base 寸法は「デザイン単位」。engine 側で rs 倍する。
// ============================================================================

/**
 * @typedef {import('./engine.js')} _
 */

/** プログラム型フレーム定義。base は portrait 基準の外形（単位px）。 */
export const FRAMES = [
  // ---- Phone ----
  // iPhone は写実的なベクター枠（本体PNG＋Dynamic Island を別レイヤ）を使うアセット型。
  // Island は overlay なので settings.hideNotch で非表示にできる。
  {
    id: 'iphone-island', label: 'iPhone (Dynamic Island)', group: 'スマートフォン',
    canRotate: true, viewport: { w: 1179, h: 2556 }, css: { w: 393, h: 852, mobile: true }, kind: 'asset',
    asset: {
      baseImageUrl: '/frames/iphone_body.png',
      overlayImageUrl: '/frames/iphone_island.png',
      screenOnTop: true,
      // 素材 viewBox 241.43×497.16 を 1.8 倍（他スマホ枠と同程度の大きさ）。
      imageSize: { w: 434.57, h: 894.89 },
      screen: { x: 20.56, y: 18.83, w: 395.87, h: 857.23, radius: 55.15 },
      outerRadius: 69.7,
    },
  },
  {
    id: 'iphone-notch', label: 'iPhone (ノッチ)', group: 'スマートフォン',
    canRotate: true, viewport: { w: 1125, h: 2436 }, css: { w: 375, h: 812, mobile: true }, kind: 'programmatic',
    spec: {
      base: { w: 420, h: 880 }, bez: 16, bezTop: 16, bezBottom: 16, bezSide: 16,
      ro: 50, ri: 36, cutout: 'notch', buttons: true, camDot: false, draw: 'slab',
    },
  },
  {
    id: 'iphone-se', label: 'iPhone SE', group: 'スマートフォン',
    canRotate: true, viewport: { w: 750, h: 1334 }, css: { w: 375, h: 667, mobile: true }, kind: 'programmatic',
    spec: {
      base: { w: 400, h: 800 }, bez: 20, bezTop: 60, bezBottom: 80, bezSide: 20,
      ro: 44, ri: 6, cutout: 'none', buttons: true, camDot: true, home: true, draw: 'slab',
    },
  },
  {
    id: 'android-pixel', label: 'Android (Pixel)', group: 'スマートフォン',
    canRotate: true, viewport: { w: 1080, h: 2400 }, css: { w: 412, h: 915, mobile: true }, kind: 'programmatic',
    spec: {
      base: { w: 420, h: 900 }, bez: 12, bezTop: 12, bezBottom: 12, bezSide: 12,
      ro: 44, ri: 34, cutout: 'holecenter', buttons: true, camDot: false, draw: 'slab',
    },
  },
  {
    id: 'android-galaxy', label: 'Android (Galaxy)', group: 'スマートフォン',
    canRotate: true, viewport: { w: 1080, h: 2316 }, css: { w: 360, h: 772, mobile: true }, kind: 'programmatic',
    spec: {
      base: { w: 420, h: 890 }, bez: 10, bezTop: 10, bezBottom: 10, bezSide: 10,
      ro: 46, ri: 38, cutout: 'holecenter', buttons: true, camDot: false, draw: 'slab',
    },
  },
  // ---- Tablet ----
  {
    id: 'ipad', label: 'iPad', group: 'タブレット',
    canRotate: true, viewport: { w: 1640, h: 2360 }, css: { w: 820, h: 1180, mobile: true }, kind: 'programmatic',
    spec: {
      base: { w: 760, h: 1050 }, bez: 26, bezTop: 26, bezBottom: 26, bezSide: 26,
      ro: 38, ri: 18, cutout: 'none', camDot: true, draw: 'slab',
    },
  },
  {
    id: 'ipad-home', label: 'iPad (ホームボタン)', group: 'タブレット',
    canRotate: true, viewport: { w: 1620, h: 2160 }, css: { w: 810, h: 1080, mobile: true }, kind: 'programmatic',
    spec: {
      base: { w: 760, h: 1060 }, bez: 40, bezTop: 70, bezBottom: 70, bezSide: 40,
      ro: 30, ri: 8, cutout: 'none', camDot: true, home: true, draw: 'slab',
    },
  },
  // ---- Laptop ----
  // MacBook は写実的なベクター枠（開いた状態・キーボード付き）を使うアセット型。
  // baseImageUrl は起動時に loadBuiltinAssetFrames() でデコードして _baseImg に載る。
  // 素材 viewBox 890.16×505.94 を 1.438 倍した「デザイン単位」。
  {
    id: 'macbook', label: 'MacBook', group: 'ノートPC',
    canRotate: false, viewport: { w: 1512, h: 950 }, kind: 'asset',
    asset: {
      baseImageUrl: '/frames/macbook_open.png',
      screenOnTop: true,
      imageSize: { w: 1280, h: 727.5 },
      screen: { x: 183.03, y: 14.77, w: 914.01, h: 580.91, radius: 12.94 },
      outerRadius: 16,
    },
  },
  // ---- Monitor ----
  {
    id: 'monitor', label: 'デスクトップモニター', group: 'モニター',
    canRotate: false, viewport: { w: 2560, h: 1440 }, kind: 'programmatic',
    spec: {
      base: { w: 1280, h: 900 }, bez: 18, bezTop: 18, bezBottom: 18, bezSide: 18,
      ro: 14, ri: 4, cutout: 'none', standH: 90, draw: 'monitor',
    },
  },
  // ---- Browser ----
  {
    id: 'browser', label: 'ブラウザ', group: 'ブラウザ',
    canRotate: false, viewport: { w: 1440, h: 900 }, kind: 'programmatic',
    spec: {
      base: { w: 1280, h: 820 }, ro: 12, barH: 38, draw: 'browser',
    },
  },
];

/**
 * サイト撮影用のビューポート（§3.2 / URL・フォルダ描画）。
 * frame.viewport は「物理ピクセル解像度」。それをそのまま表示幅に使うと
 * 幅が大きすぎてサイトがPCレイアウトになってしまう（例: iPhone=1179px→PC扱い）。
 * DevTools のデバイスモードと同じく、CSS論理サイズ(css)＋DPR で開くことでスマホUIになる。
 * @returns {{ w:number, h:number, dpr:number, mobile:boolean }}
 */
export function captureViewportFor(device, orientation) {
  const frame = getFrame(device);
  const phys = frame.viewport;
  const land = frame.canRotate && orientation === 'landscape';
  if (frame.css) {
    let cw = frame.css.w, ch = frame.css.h;
    if (land) [cw, ch] = [ch, cw];
    const pw = land ? phys.h : phys.w; // 物理幅（回転考慮）→ DPR は物理解像度に合わせる
    const dpr = Math.max(1, Math.min(4, pw / cw));
    return { w: cw, h: ch, dpr, mobile: !!frame.css.mobile };
  }
  // デスクトップ系（ノートPC/モニター/ブラウザ）は論理=物理でよい（PCレイアウトが正しい）。
  const w = land ? phys.h : phys.w, h = land ? phys.w : phys.h;
  return { w, h, dpr: 2, mobile: false };
}

const BUILTIN_MAP = new Map(FRAMES.map((f) => [f.id, f]));

// ユーザー定義（アセット型）フレームの実行時レジストリ（§3.10）。
let customMap = new Map();

// フレームメーカーのライブプレビュー用の一時フレーム（保存前）。id は PREVIEW_FRAME_ID。
export const PREVIEW_FRAME_ID = '__preview__';
let previewFrame = null;

/** カスタムフレーム群を登録（画像デコード済みの FrameDef 配列）。 */
export function registerCustomFrames(list) {
  customMap = new Map((list || []).map((f) => [f.id, f]));
}

/** フレームメーカーのプレビュー用フレームを差し替え（null で解除）。 */
export function setPreviewFrame(def) {
  previewFrame = def ? { ...def, id: PREVIEW_FRAME_ID } : null;
}

/** 全フレーム（ビルトイン＋カスタム）。プレビューは一覧には出さない。 */
export function allFrames() {
  return [...FRAMES, ...customMap.values()];
}

/** id から FrameDef を取得（プレビュー→カスタム優先 / 無ければ既定の iphone-island）。 */
export function getFrame(id) {
  if (previewFrame && id === PREVIEW_FRAME_ID) return previewFrame;
  return customMap.get(id) || BUILTIN_MAP.get(id) || FRAMES[0];
}

/** UI 用: group ごとにまとめた optgroup 構造。 */
export function framesByGroup() {
  const groups = new Map();
  for (const f of allFrames()) {
    if (!groups.has(f.group)) groups.set(f.group, []);
    groups.get(f.group).push(f);
  }
  return Array.from(groups, ([group, items]) => ({ group, items }));
}

/** デバイス大分類（グループ）の一覧（重複なし・定義順）。左ペインの種類選択用。 */
export function groupNames() {
  const seen = [];
  for (const f of allFrames()) if (!seen.includes(f.group)) seen.push(f.group);
  return seen;
}

/** 指定グループ内のフレーム一覧（右パネルの機種選択用）。 */
export function framesInGroup(group) {
  return allFrames().filter((f) => f.group === group);
}

/** device id が属するグループ名。 */
export function groupOf(id) {
  return getFrame(id).group;
}

/** グループの既定フレーム id（そのグループの先頭）。左で種類を変えた時の初期機種。 */
export function defaultDeviceForGroup(group) {
  const list = framesInGroup(group);
  return (list[0] || FRAMES[0]).id;
}

// ---------------------------------------------------------------------------
// 実解像度マップ（§3.2 解像度マッチ用）。各エントリ [w,h] は portrait 基準。
// device は FrameDef.id に対応。
// ---------------------------------------------------------------------------
export const RESOLUTION_MAP = [
  { device: 'iphone-island', sizes: [[1170, 2532], [1179, 2556], [1290, 2796], [1206, 2622]] },
  { device: 'iphone-notch', sizes: [[1125, 2436], [1284, 2778]] },
  { device: 'iphone-se', sizes: [[750, 1334]] },
  { device: 'android-pixel', sizes: [[1080, 2400], [1080, 2340], [1344, 2992]] },
  { device: 'android-galaxy', sizes: [[1080, 2316], [1440, 3088]] },
  { device: 'ipad', sizes: [[1640, 2360], [1620, 2160], [2048, 2732], [1668, 2388]] },
  { device: 'macbook', sizes: [[1440, 900], [1512, 982], [1728, 1117], [2560, 1600]] },
  { device: 'browser', sizes: [[1920, 1080], [2560, 1440], [3840, 2160], [1366, 768]] },
];

/**
 * フレーム定義から画面領域（portrait基準）の基本寸法を取得。
 * @param {object} frame
 * @param {number} [imageAspect]
 * @returns {{ w: number, h: number }}
 */
export function getScreenBaseSize(frame, imageAspect) {
  if (!frame) return { w: 390, h: 844 };
  if (frame.kind === 'asset' && frame.asset?.screen) {
    return { w: frame.asset.screen.w, h: frame.asset.screen.h };
  }
  const spec = frame.spec;
  if (!spec) return { w: 390, h: 844 };
  const draw = spec.draw || 'slab';
  if (draw === 'browser') {
    const sw = spec.base.w;
    if (imageAspect) {
      return { w: sw, h: sw / imageAspect };
    }
    const barH = spec.barH ?? 38;
    return { w: sw, h: spec.base.h - barH };
  }
  if (draw === 'laptop') {
    const bez = spec.bez ?? 18;
    return { w: spec.base.w - bez * 2, h: spec.base.h - bez * 2 };
  }
  if (draw === 'monitor') {
    const bez = spec.bez ?? 18;
    const standH = spec.standH ?? 90;
    return { w: spec.base.w - bez * 2, h: spec.base.h - standH - bez * 2 };
  }
  // slab
  const bez = spec.bez ?? 12;
  const bt = spec.bezTop ?? bez, bb = spec.bezBottom ?? bez;
  const bl = spec.bezSide ?? spec.bezLeft ?? bez;
  const br = spec.bezSide ?? spec.bezRight ?? bez;
  return { w: spec.base.w - (bl + br), h: spec.base.h - (bt + bb) };
}

/**
 * アイテムの元画像解像度に合わせて、画面領域が原寸（100%）になる最適スケールを算出。
 * @param {object} item
 * @param {object} [frame]
 * @returns {number}
 */
export function calcNativeScale(item, frame) {
  if (!item || !item.img || !item.img.width || !item.img.height) return 2;
  const f = frame || getFrame(item.device);
  const iw = item.img.width;
  const ih = item.img.height;
  const ia = iw / ih;
  const baseScreen = getScreenBaseSize(f, ia);
  const land = f.canRotate && item.orientation === 'landscape';
  const sw = land ? baseScreen.h : baseScreen.w;
  const sh = land ? baseScreen.w : baseScreen.h;
  if (!sw || !sh) return 2;
  const scale = Math.max(iw / sw, ih / sh);
  // 極端な値（0.5未満や10超）をクランプ
  return Math.max(1, Math.min(6, scale));
}
