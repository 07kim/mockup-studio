// ============================================================================
// Mockup Studio 合成エンジン（純関数）
// canvas を返す。DOM 走査やグローバル状態に依存しない（クライアント専用）。
// SPEC §7 / §3.5 / §12 に対応。
// ============================================================================

import { getFrame } from './devices.js';

// ---------------------------------------------------------------------------
// 色ユーティリティ（SPEC §3.5: mixc / lum / palette 自動導出）
// ---------------------------------------------------------------------------

/** '#rrggbb' → {r,g,b}（0..255）。短縮形 '#rgb' も許容。 */
export function hexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** {r,g,b} → '#rrggbb' */
export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** 相対輝度 0..1（sRGB → 線形化 → 輝度）。§3.5 の light 判定に使用。 */
export function lum(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** hex を白(amount>0)/黒(amount<0)へ amount(-1..1) 分だけ混ぜる。 */
export function mixc(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const t = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  return rgbToHex({ r: r + (t - r) * a, g: g + (t - g) * a, b: b + (t - b) * a });
}

/** 2色を混ぜる（ratio: 0=hex1, 1=hex2）。 */
export function blend(hex1, hex2, ratio) {
  const a = hexToRgb(hex1), b = hexToRgb(hex2);
  return rgbToHex({
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  });
}

/**
 * ベース色 1 つから palette を導出（§3.5）。
 * 明るい色なら暗い方向、暗い色なら明るい方向へフチ/側面などを調整。
 * カットアウト(notch)は常に黒。
 */
export function derivePalette(baseHex) {
  const isLight = lum(baseHex) > 0.5;
  const s = isLight ? -1 : 1; // 明るい色→暗く、暗い色→明るく振る向き
  return {
    base: baseHex,
    isLight,
    edge: mixc(baseHex, s * 0.28), // フチ/ハイライト
    side: mixc(baseHex, -0.35), // 厚みの側面/陰（常に少し暗く）
    deck: mixc(baseHex, s * 0.12), // ノートPCデッキ
    notch: '#000000', // カットアウトは常に黒
    dot: mixc(baseHex, s * 0.5), // カメラ点
    chrome: isLight ? '#f3f4f6' : '#2a2d34', // ブラウザ chrome
    chromeText: isLight ? '#6b7280' : '#9aa0a8',
  };
}

// ---------------------------------------------------------------------------
// 幾何ユーティリティ
// ---------------------------------------------------------------------------

/**
 * fit 計算（§3.5 cover/contain/stretch）。
 * 画像(imgW×imgH)を矩形(boxW×boxH)に収める描画パラメータを返す。
 * cover: はみ出しを source 側でクロップ / contain: box 内に収め letterbox
 * stretch: box いっぱいに引き伸ばし
 * @returns {{sx,sy,sw,sh,dx,dy,dw,dh}} drawImage 用の source/dest 矩形（dx/dy は box 相対）
 */
export function fitRect(imgW, imgH, boxW, boxH, mode) {
  if (mode === 'stretch') {
    return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx: 0, dy: 0, dw: boxW, dh: boxH };
  }
  const rImg = imgW / imgH;
  const rBox = boxW / boxH;
  if (mode === 'contain') {
    let dw, dh;
    if (rImg > rBox) { dw = boxW; dh = boxW / rImg; }
    else { dh = boxH; dw = boxH * rImg; }
    return {
      sx: 0, sy: 0, sw: imgW, sh: imgH,
      dx: (boxW - dw) / 2, dy: (boxH - dh) / 2, dw, dh,
    };
  }
  // cover（既定）
  let sw, sh;
  if (rImg > rBox) { sh = imgH; sw = imgH * rBox; }
  else { sw = imgW; sh = imgW / rBox; }
  return {
    sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh,
    dx: 0, dy: 0, dw: boxW, dh: boxH,
  };
}

/** 角丸矩形のパスを ctx に設定。 */
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// canvas 生成はブラウザ既定。CLI（Node）では setCanvasFactory で @napi-rs/canvas を注入する。
let _canvasFactory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** canvas 生成関数を差し替える（CLI 用・§8 / §10 P8）。 */
export function setCanvasFactory(fn) {
  _canvasFactory = fn;
}

function makeCanvas(w, h) {
  return _canvasFactory(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

// ---------------------------------------------------------------------------
// 向き対応: spec を orientation に合わせて変換
// ---------------------------------------------------------------------------

/**
 * portrait 定義の spec を orientation に合わせて幅高さ・ベゼル・カットアウト位置を変換。
 * landscape は 90°回転（上→左）として扱う。
 */
function orientedSpec(spec, orientation) {
  if (orientation !== 'landscape') return { ...spec, _land: false };
  return {
    ...spec,
    _land: true,
    base: { w: spec.base.h, h: spec.base.w },
    // 上下ベゼル→左右、左右→上下 に入れ替え
    bezTop: spec.bezSide ?? spec.bez,
    bezBottom: spec.bezSide ?? spec.bez,
    bezSideL: spec.bezTop ?? spec.bez, // 元の上ベゼル（カットアウト側）を左へ
    bezSideR: spec.bezBottom ?? spec.bez,
  };
}

/** spec から画面矩形（face 座標・rs 適用前の unit）を算出。 */
function screenRectOf(spec) {
  const bez = spec.bez ?? 12;
  const top = spec._land ? spec.bezTop : (spec.bezTop ?? bez);
  const bottom = spec._land ? spec.bezBottom : (spec.bezBottom ?? bez);
  const left = spec._land ? (spec.bezSideL ?? bez) : (spec.bezSide ?? bez);
  const right = spec._land ? (spec.bezSideR ?? bez) : (spec.bezSide ?? bez);
  return {
    x: left,
    y: top,
    w: spec.base.w - left - right,
    h: spec.base.h - top - bottom,
  };
}

// ---------------------------------------------------------------------------
// 画面（スクショ）を screen 矩形に描画
// ---------------------------------------------------------------------------

function drawScreen(ctx, img, screen, ri, settings, rs) {
  ctx.save();
  roundRectPath(ctx, screen.x, screen.y, screen.w, screen.h, ri);
  ctx.clip();
  // contain の余白色
  ctx.fillStyle = settings.screenBg || '#ffffff';
  ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
  if (img && img.width) {
    const f = fitRect(img.width, img.height, screen.w, screen.h, settings.fit);
    ctx.drawImage(img, f.sx, f.sy, f.sw, f.sh, screen.x + f.dx, screen.y + f.dy, f.dw, f.dh);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// プログラム型フレーム描画（§3.3a）
// 各関数は face 用 canvas を返す（rs 適用済みピクセル）。
// ---------------------------------------------------------------------------

function drawSlab(spec, img, settings, pal, rs) {
  const W = spec.base.w * rs, H = spec.base.h * rs;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const ro = (spec.ro ?? 44) * rs;
  const ri = (spec.ri ?? 34) * rs;
  const screen = screenRectOf(spec);
  const S = { x: screen.x * rs, y: screen.y * rs, w: screen.w * rs, h: screen.h * rs };

  // 本体
  roundRectPath(ctx, 0, 0, W, H, ro);
  ctx.fillStyle = pal.base;
  ctx.fill();
  // フチのハイライト
  ctx.lineWidth = Math.max(1, 1.5 * rs);
  ctx.strokeStyle = pal.edge;
  roundRectPath(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth, ro);
  ctx.stroke();

  // 画面
  drawScreen(ctx, img, S, ri, settings, rs);

  // カットアウト（island / notch / hole）
  drawCutout(ctx, spec, S, rs, pal);
  // 上ベゼルのカメラ（ホームボタン機・タブレット）
  if (spec.camDot) drawTopCamera(ctx, spec, W, S, rs, pal);
  // ホームボタン（下ベゼル）
  if (spec.home) drawHome(ctx, spec, W, H, S, rs, pal);
  // サイドボタン
  if (spec.buttons) drawButtons(ctx, spec, W, H, rs, pal);

  return { canvas: c, ri, ro };
}

function drawCutout(ctx, spec, S, rs, pal) {
  const cut = spec.cutout || 'none';
  if (cut === 'none') return;
  ctx.fillStyle = pal.notch; // 常に黒
  const land = spec._land;
  // 上辺方向(across)と奥行き方向(down)。アスペクトが極端でも破綻しないよう down でキャップ。
  const across = land ? S.h : S.w;
  const down = land ? S.w : S.h;

  if (cut === 'island') {
    // Dynamic Island: 上辺から少し下に浮く角丸ピル（実機比 ≒ 3.3:1）。
    const w = Math.min(across * 0.30, down * 0.15);
    const h = w * 0.30;
    const gap = h * 0.9; // 画面上端からの距離
    if (land) roundRectPath(ctx, S.x + gap, S.y + S.h / 2 - w / 2, h, w, h / 2);
    else roundRectPath(ctx, S.x + S.w / 2 - w / 2, S.y + gap, w, h, h / 2);
    ctx.fill();
  } else if (cut === 'notch') {
    // クラシックなノッチ: 上ベゼルから垂れ下がり、付け根が外側へ広がる（肩=shoulder）。
    // 下側 2 角は大きめの角丸。これで「黒い帯」ではなく実機のノッチに見える。
    const w = Math.min(across * 0.46, down * 0.26); // 中央部の幅
    const h = w * 0.30;                              // 垂れ下がる深さ
    const r = Math.min(h * 0.55, w * 0.16);          // 下角の丸み
    const s = Math.min(h * 0.6, w * 0.12);           // 付け根の広がり
    const half = w / 2;
    ctx.beginPath();
    if (land) {
      const cy = S.y + S.h / 2, x0 = S.x;
      ctx.moveTo(x0, cy - half - s);
      ctx.quadraticCurveTo(x0, cy - half, x0 + s, cy - half);
      ctx.lineTo(x0 + h - r, cy - half);
      ctx.arcTo(x0 + h, cy - half, x0 + h, cy - half + r, r);
      ctx.lineTo(x0 + h, cy + half - r);
      ctx.arcTo(x0 + h, cy + half, x0 + h - r, cy + half, r);
      ctx.lineTo(x0 + s, cy + half);
      ctx.quadraticCurveTo(x0, cy + half, x0, cy + half + s);
    } else {
      const cx = S.x + S.w / 2, y0 = S.y;
      ctx.moveTo(cx - half - s, y0);
      ctx.quadraticCurveTo(cx - half, y0, cx - half, y0 + s);
      ctx.lineTo(cx - half, y0 + h - r);
      ctx.arcTo(cx - half, y0 + h, cx - half + r, y0 + h, r);
      ctx.lineTo(cx + half - r, y0 + h);
      ctx.arcTo(cx + half, y0 + h, cx + half, y0 + h - r, r);
      ctx.lineTo(cx + half, y0 + s);
      ctx.quadraticCurveTo(cx + half, y0, cx + half + s, y0);
    }
    ctx.closePath();
    ctx.fill();
  } else if (cut === 'holecenter') {
    const r = Math.min(across * 0.02, down * 0.018);
    const gap = r * 2.6;
    ctx.beginPath();
    if (land) ctx.arc(S.x + gap, S.y + S.h / 2, r, 0, Math.PI * 2);
    else ctx.arc(S.x + S.w / 2, S.y + gap, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 上ベゼルのカメラ（SE / iPad など）。 */
function drawTopCamera(ctx, spec, W, S, rs, pal) {
  const land = spec._land;
  const cx = land ? S.x / 2 : W / 2;
  const cy = land ? (S.y + S.h / 2) : S.y / 2;
  const bezel = land ? S.x : S.y;
  const r = Math.max(1.5 * rs, Math.min(bezel * 0.16, 4 * rs));
  ctx.fillStyle = mixc(pal.base, pal.isLight ? -0.4 : 0.55);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

/** 下ベゼルのホームボタン（iPhone SE / iPad(ホーム)）。 */
function drawHome(ctx, spec, W, H, S, rs, pal) {
  const land = spec._land;
  const bandStart = land ? S.x + S.w : S.y + S.h; // 下(奥)ベゼルの開始
  const bandSize = (land ? W : H) - bandStart;
  if (bandSize <= 4) return;
  const cx = land ? bandStart + bandSize / 2 : W / 2;
  const cy = land ? H / 2 : bandStart + bandSize / 2;
  const r = Math.min(bandSize * 0.34, S.w * 0.07);
  if (r < 3) return;
  ctx.strokeStyle = mixc(pal.base, pal.isLight ? -0.28 : 0.4);
  ctx.lineWidth = Math.max(1, 1.6 * rs);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}

function drawButtons(ctx, spec, W, H, rs, pal) {
  ctx.fillStyle = pal.side;
  const land = spec._land;
  const bw = 3 * rs;
  if (!land) {
    // 右: 電源 / 左: 音量
    roundRectPath(ctx, W - bw / 2, H * 0.24, bw, H * 0.10, bw);
    ctx.fill();
    roundRectPath(ctx, -bw / 2, H * 0.20, bw, H * 0.06, bw);
    ctx.fill();
    roundRectPath(ctx, -bw / 2, H * 0.30, bw, H * 0.10, bw);
    ctx.fill();
  } else {
    roundRectPath(ctx, W * 0.24, -bw / 2, W * 0.10, bw, bw);
    ctx.fill();
    roundRectPath(ctx, W * 0.20, H - bw / 2, W * 0.06, bw, bw);
    ctx.fill();
  }
}

function drawLaptop(spec, img, settings, pal, rs) {
  // MacBook 正面図: 薄ベゼルのふた（画面＋ノッチ）＋下に薄いアルミの前縁（指かけの溝つき）
  const lidW = spec.base.w * rs;
  const lidH = spec.base.h * rs;
  const lipH = Math.max(9, 15 * rs);   // 底面の前縁の高さ
  const overhang = 24 * rs;            // 前縁はふたより左右に張り出す
  const W = lidW + overhang * 2;
  const H = lidH + lipH;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const lidX = overhang;

  const ro = (spec.ro ?? 20) * rs;
  const ri = (spec.ri ?? 6) * rs;
  const bez = (spec.bez ?? 18) * rs;
  const S = { x: lidX + bez, y: bez, w: lidW - bez * 2, h: lidH - bez * 2 };

  // ふた本体
  roundRectPath(ctx, lidX, 0, lidW, lidH, ro);
  ctx.fillStyle = pal.base;
  ctx.fill();
  // 画面
  drawScreen(ctx, img, S, ri, settings, rs);
  // ノッチ（上ベゼル中央）＋カメラ
  const nw = lidW * 0.13, nh = bez * 0.66, nx = lidX + lidW / 2 - nw / 2, nr = Math.min(nh * 0.5, nw * 0.2);
  ctx.fillStyle = pal.notch;
  ctx.beginPath();
  ctx.moveTo(nx, 0);
  ctx.lineTo(nx + nw, 0);
  ctx.lineTo(nx + nw, nh - nr);
  ctx.arcTo(nx + nw, nh, nx + nw - nr, nh, nr);
  ctx.lineTo(nx + nr, nh);
  ctx.arcTo(nx, nh, nx, nh - nr, nr);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mixc(pal.base, pal.isLight ? -0.3 : 0.55);
  ctx.beginPath(); ctx.arc(lidX + lidW / 2, nh * 0.5, 1.6 * rs, 0, Math.PI * 2); ctx.fill();

  // 底面の前縁（台形＋下角丸＋中央の溝）
  const topY = lidH, botY = lidH + lipH, cx = W / 2;
  const gw = lidW * 0.10, gh = lipH * 0.55, r2 = Math.min(6 * rs, lipH * 0.5);
  const grd = ctx.createLinearGradient(0, topY, 0, botY);
  grd.addColorStop(0, mixc(pal.deck, pal.isLight ? 0 : 0.06));
  grd.addColorStop(1, pal.side);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(lidX, topY);
  ctx.lineTo(cx - gw / 2, topY);
  ctx.quadraticCurveTo(cx, topY + gh, cx + gw / 2, topY);
  ctx.lineTo(lidX + lidW, topY);
  ctx.lineTo(W - r2, topY);
  ctx.arcTo(W, topY, W, topY + r2, r2);
  ctx.lineTo(W, botY - r2);
  ctx.arcTo(W, botY, W - r2, botY, r2);
  ctx.lineTo(r2, botY);
  ctx.arcTo(0, botY, 0, botY - r2, r2);
  ctx.lineTo(0, topY + r2);
  ctx.arcTo(0, topY, r2, topY, r2);
  ctx.closePath();
  ctx.fill();

  return { canvas: c, ri, ro };
}

function drawMonitor(spec, img, settings, pal, rs) {
  const standH = (spec.standH ?? 90) * rs;
  const screenPart = { ...spec, base: { w: spec.base.w, h: spec.base.h - (spec.standH ?? 90) } };
  const W = spec.base.w * rs;
  const H = spec.base.h * rs;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const ro = (spec.ro ?? 14) * rs;
  const ri = (spec.ri ?? 4) * rs;
  const screen = screenRectOf(screenPart);
  const S = { x: screen.x * rs, y: screen.y * rs, w: screen.w * rs, h: screen.h * rs };
  const bodyH = screenPart.base.h * rs;

  roundRectPath(ctx, 0, 0, W, bodyH, ro);
  ctx.fillStyle = pal.base;
  ctx.fill();
  drawScreen(ctx, img, S, ri, settings, rs);

  // スタンド
  ctx.fillStyle = pal.side;
  const neckW = 40 * rs;
  ctx.fillRect(W / 2 - neckW / 2, bodyH, neckW, standH * 0.6);
  ctx.fillStyle = pal.deck;
  roundRectPath(ctx, W / 2 - 90 * rs, bodyH + standH * 0.6, 180 * rs, standH * 0.4, 6 * rs);
  ctx.fill();

  return { canvas: c, ri, ro };
}

function drawBrowser(spec, img, settings, pal, rs) {
  const W = spec.base.w * rs, H = spec.base.h * rs;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const ro = (spec.ro ?? 12) * rs;
  const barH = (spec.barH ?? 38) * rs;

  // ウィンドウ本体
  roundRectPath(ctx, 0, 0, W, H, ro);
  ctx.fillStyle = pal.chrome;
  ctx.fill();

  // タイトルバー（トラフィックライト＋アドレスバー）
  ctx.save();
  roundRectPath(ctx, 0, 0, W, barH, ro);
  ctx.clip();
  ctx.fillStyle = pal.chrome;
  ctx.fillRect(0, 0, W, barH);
  ctx.restore();
  const dotR = 5.5 * rs;
  const dots = ['#ff5f57', '#febc2e', '#28c840'];
  dots.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc((16 + i * 20) * rs, barH / 2, dotR, 0, Math.PI * 2);
    ctx.fill();
  });
  // アドレスバー
  ctx.fillStyle = mixc(pal.chrome, pal.isLight ? -0.06 : 0.10);
  roundRectPath(ctx, 84 * rs, barH * 0.22, W - 84 * rs - 16 * rs, barH * 0.56, barH * 0.28);
  ctx.fill();

  // コンテンツ領域＝画面
  const S = { x: 0, y: barH, w: W, h: H - barH };
  drawScreen(ctx, img, S, 0, settings, rs);
  // 下の角丸をクリップ用に本体で上書き（角の枠色）
  ctx.strokeStyle = mixc(pal.chrome, pal.isLight ? -0.10 : 0.14);
  ctx.lineWidth = Math.max(1, rs);
  roundRectPath(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth, ro);
  ctx.stroke();

  return { canvas: c, ri: 0, ro };
}

// ---------------------------------------------------------------------------
// アセット型フレーム描画（§3.3b / §3.10）
// 合成順: screen背景 → スクショ(screen矩形にfit) → base画像(前面) → overlay(任意)
// base 画像は画面領域を透明に抜いた PNG を前提。
// ---------------------------------------------------------------------------
function drawAssetFrame(frame, item, settings, rs) {
  const asset = frame.asset;
  const base = frame._baseImg; // 事前デコード済み HTMLImageElement
  // 素材は portrait 基準。canRotate なフレームで landscape 指定なら枠画像を90°回して使う。
  const land = frame.canRotate && item.orientation === 'landscape';
  const pW = asset.imageSize.w * rs; // portrait のキャンバス幅
  const pH = asset.imageSize.h * rs;
  const W = land ? pH : pW;
  const H = land ? pW : pH;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');

  // 画面矩形（portrait 座標×rs）。landscape なら 90°CW 回転した矩形にする。
  let S = {
    x: asset.screen.x * rs, y: asset.screen.y * rs,
    w: asset.screen.w * rs, h: asset.screen.h * rs,
  };
  if (land) S = { x: pH - (S.y + S.h), y: S.x, w: S.h, h: S.w };
  const radius = (asset.screen.radius || 0) * rs;
  const ro = (asset.outerRadius || asset.screen.radius || 0) * rs;

  // 枠画像を（必要なら90°CW回して）キャンバス全体に描く。
  const drawFrameImg = (img) => {
    if (!img || !img.width) return;
    if (land) {
      ctx.save();
      ctx.translate(W, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0, pW, pH);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, W, H);
    }
  };

  if (asset.screenOnTop) {
    // ベクター枠（画面が塗り潰し）用: 枠 → スクショ（画面を覆う）→ ノッチ の順。
    drawFrameImg(base);
    drawScreen(ctx, item.img, S, radius, settings, rs);
  } else {
    // 従来: スクショ → 枠(画面部分が透明) → overlay。
    drawScreen(ctx, item.img, S, radius, settings, rs);
    drawFrameImg(base);
  }
  // overlay（ノッチ / Dynamic Island など。設定で非表示にできる）
  if (!settings.hideNotch) drawFrameImg(frame._overlayImg);

  return { canvas: c, ri: radius, ro };
}

/** ベゼル厚を保ったまま画面のアスペクト比を画像に合わせた spec を返す（§画像に合わせる）。 */
function fitFrameToImage(spec, imageAspect) {
  const bez = spec.bez ?? 12;
  const bt = spec.bezTop ?? bez, bb = spec.bezBottom ?? bez, bs = spec.bezSide ?? bez;
  const sh = spec.base.h - bt - bb; // 画面高は維持
  const sw = Math.max(40, sh * imageAspect); // 画面幅を画像比に合わせる
  return { ...spec, _land: false, base: { w: sw + bs * 2, h: spec.base.h } };
}

/** frame + item から face canvas を生成。 */
function drawFace(frame, item, settings, rs) {
  if (frame.kind === 'asset') return drawAssetFrame(frame, item, settings, rs);
  // 回転不可デバイス（ブラウザ/ノートPC/モニター）は本来の向き固定。orientation は無視。
  const effectiveOrientation = frame.canRotate ? item.orientation : 'portrait';
  let spec = orientedSpec(frame.spec, effectiveOrientation);
  let fit = settings.fit;

  // 「画像に合わせる」= フレームを画像のアスペクト比に成形（スマホ/タブレット枠のみ）。
  // 非スマホ枠は「全体（contain）」にフォールバックして切れないようにする。
  if (fit === 'frame' && item.img && item.img.width) {
    const ia = item.img.width / item.img.height;
    if ((frame.spec.draw || 'slab') === 'slab') spec = fitFrameToImage(frame.spec, ia);
    else fit = 'contain';
  }
  const drawSettings = fit === settings.fit ? settings : { ...settings, fit };

  const pal = derivePalette(settings.frameColor || '#15171c');
  const s = settings.frameStyle === 'minimal'
    ? { ...spec, bez: Math.max(4, (spec.bez ?? 12) * 0.5), buttons: false, camDot: false }
    : spec;
  const img = item.img;
  switch (spec.draw) {
    case 'laptop': return drawLaptop(s, img, drawSettings, pal, rs);
    case 'monitor': return drawMonitor(s, img, drawSettings, pal, rs);
    case 'browser': return drawBrowser(s, img, drawSettings, pal, rs);
    case 'slab':
    default: return drawSlab(s, img, drawSettings, pal, rs);
  }
}

// ---------------------------------------------------------------------------
// 3D 傾き（§3.5 / §7 build3D）: 遠近ワープ＋厚み側面
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

/** perspTick(0..100) → 焦点距離倍率 mult(1.3..7)。小さいほど遠近が強い（手前が大きく奥が小さい）。 */
function perspMult(tick) {
  const t = Math.max(0, Math.min(100, tick ?? 40)) / 100;
  return 1.3 + t * (7 - 1.3);
}

/** 3D 回転＋透視投影。face 中心原点、z は手前が + 。 */
function project(x, y, z, rotX, rotY, f) {
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(rotX), sx = Math.sin(rotX);
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const s = f / (f - z2);
  return { X: x1 * s, Y: y2 * s };
}

/** source→dest 三角形のアフィン変換係数 [a,b,c,d,e,f]。 */
function affine(s, d) {
  const [x0, y0, x1, y1, x2, y2] = s;
  const [u0, v0, u1, v1, u2, v2] = d;
  const D = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  if (Math.abs(D) < 1e-9) return null;
  return [
    (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / D,
    (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / D,
    (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / D,
    (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / D,
    (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / D,
    (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / D,
  ];
}

/** 三角形を重心方向に少し拡大（シーム対策）。 */
function expandTri(p, amt) {
  const cx = (p[0] + p[2] + p[4]) / 3;
  const cy = (p[1] + p[3] + p[5]) / 3;
  const out = [];
  for (let i = 0; i < 6; i += 2) {
    const dx = p[i] - cx, dy = p[i + 1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    out.push(p[i] + (dx / len) * amt, p[i + 1] + (dy / len) * amt);
  }
  return out;
}

/** 多角形の符号付き面積（シューレース）。 */
function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i][0] * p[j][1] - p[j][0] * p[i][1];
  }
  return a / 2;
}

function drawTexturedTriangle(ctx, img, src, dst) {
  const d = expandTri(dst, 1.1);
  const m = affine(src, d);
  if (!m) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d[0], d[1]);
  ctx.lineTo(d[2], d[3]);
  ctx.lineTo(d[4], d[5]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** 角丸矩形の外周サンプル点（face 座標）を返す。ro=0 なら 4 隅の矩形。 */
function roundedRectOutline(W, H, r, cornerSteps = 10) {
  const rr = Math.max(0, Math.min(r, W / 2, H / 2));
  if (rr <= 0.5) return [[0, 0], [W, 0], [W, H], [0, H]];
  const pts = [];
  const arc = (cx, cy, a0, a1) => {
    for (let i = 0; i <= cornerSteps; i++) {
      const a = a0 + (a1 - a0) * (i / cornerSteps);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  };
  // 時計回り: 上辺 → 右上角 → 右辺 → 右下角 → 下辺 → 左下角 → 左辺 → 左上角
  arc(W - rr, rr, -Math.PI / 2, 0);
  arc(W - rr, H - rr, 0, Math.PI / 2);
  arc(rr, H - rr, Math.PI / 2, Math.PI);
  arc(rr, rr, Math.PI, Math.PI * 1.5);
  return pts;
}

/**
 * face canvas に 3D 傾き・厚み・遠近を適用。厚みは角丸の外周に沿って押し出し、
 * 面の向きに応じて陰影を付けることで、板ではなく立体的なデバイス側面にする。
 * @returns {{canvas, w, h}}
 */
export function build3D(face, settings, N, rs, ro = 0) {
  const W = face.width, H = face.height;
  const rotX = (settings.rotX || 0) * DEG;
  const rotY = (settings.rotY || 0) * DEG;
  const thick = (settings.thickness || 0) * rs;
  const f = perspMult(settings.perspTick) * Math.max(W, H);

  if (!settings.rotX && !settings.rotY && !thick) {
    return { canvas: face, w: W, h: H };
  }

  const n = Math.max(2, N | 0);
  const front = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const p = project((i / n) * W - W / 2, (j / n) * H - H / 2, 0, rotX, rotY, f);
      front.push(p);
    }
  }
  const frontCorners = [front[0], front[n], front[(n + 1) * (n + 1) - 1], front[(n + 1) * (n + 1) - 1 - n]];

  // 見かけの大きさを一定に保つ（傾けても全体サイズが縮んだり大きくなったりしない）。
  // 遠近による台形のゆがみ＝立体感は保持したまま、投影面積だけを元の W×H に合わせて再スケール。
  const projArea = Math.abs(polyArea(frontCorners.map((p) => [p.X, p.Y])));
  const norm = projArea > 1 ? Math.sqrt((W * H) / projArea) : 1;
  if (norm !== 1) for (const p of front) { p.X *= norm; p.Y *= norm; }

  // 角丸外周を前面/背面で投影（厚みの押し出し用）
  const outline = thick > 0 ? roundedRectOutline(W, H, ro, 10) : [];
  const projF = outline.map(([x, y]) => { const p = project(x - W / 2, y - H / 2, 0, rotX, rotY, f); return { X: p.X * norm, Y: p.Y * norm }; });
  const projB = outline.map(([x, y]) => { const p = project(x - W / 2, y - H / 2, -thick, rotX, rotY, f); return { X: p.X * norm, Y: p.Y * norm }; });

  // bbox（前面グリッド＋側面外周）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of front.concat(projF, projB)) {
    if (p.X < minX) minX = p.X; if (p.Y < minY) minY = p.Y;
    if (p.X > maxX) maxX = p.X; if (p.Y > maxY) maxY = p.Y;
  }
  const pad = 0; // 傾き時も外周に余白を作らない（フレームぴったり）
  const ow = maxX - minX + pad * 2, oh = maxY - minY + pad * 2;
  const ox = -minX + pad, oy = -minY + pad;

  const out = makeCanvas(ow, oh);
  const ctx = out.getContext('2d');
  const pal = derivePalette(settings.frameColor || '#15171c');

  // --- 厚み側面: 角丸外周に沿った押し出し＋面の向きで陰影（前面より先に描く） ---
  if (thick > 0 && outline.length) {
    const cx = W / 2, cy = H / 2;
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY), cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const shadow = mixc(pal.side, -0.45);
    const light = mixc(pal.side, pal.isLight ? 0.12 : 0.45);
    const Lx = -0.35, Ly = -0.94; // 光源（画面上・やや左）
    const m = outline.length;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      const [x0, y0] = outline[i], [x1, y1] = outline[j];
      // 面内の外向き法線
      let nx = (y1 - y0), ny = -(x1 - x0);
      const midx = (x0 + x1) / 2 - cx, midy = (y0 + y1) / 2 - cy;
      if (nx * midx + ny * midy < 0) { nx = -nx; ny = -ny; }
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      // 法線を回転（方向ベクトル・z=0）
      const rx = nx * cosY;
      const rz1 = -nx * sinY;
      const ry = ny * cosX - rz1 * sinX;
      const rz = ny * sinX + rz1 * cosX;
      if (rz <= 0.02) continue; // 視点を向いていない面は描かない
      // 画面上の法線で陰影
      const sl = Math.hypot(rx, ry) || 1;
      const bright = (rx / sl) * Lx + (ry / sl) * Ly;
      const t = Math.max(0, Math.min(1, (bright + 1) / 2));
      ctx.beginPath();
      ctx.moveTo(projF[i].X + ox, projF[i].Y + oy);
      ctx.lineTo(projF[j].X + ox, projF[j].Y + oy);
      ctx.lineTo(projB[j].X + ox, projB[j].Y + oy);
      ctx.lineTo(projB[i].X + ox, projB[i].Y + oy);
      ctx.closePath();
      ctx.fillStyle = blend(shadow, light, t);
      ctx.fill();
    }
  }

  // --- 前面テクスチャワープ ---
  const idx = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const sx0 = (i / n) * W, sy0 = (j / n) * H;
      const sx1 = ((i + 1) / n) * W, sy1 = ((j + 1) / n) * H;
      const p00 = front[idx(i, j)], p10 = front[idx(i + 1, j)];
      const p11 = front[idx(i + 1, j + 1)], p01 = front[idx(i, j + 1)];
      // 三角形 1: (00,10,11)
      drawTexturedTriangle(ctx, face,
        [sx0, sy0, sx1, sy0, sx1, sy1],
        [p00.X + ox, p00.Y + oy, p10.X + ox, p10.Y + oy, p11.X + ox, p11.Y + oy]);
      // 三角形 2: (00,11,01)
      drawTexturedTriangle(ctx, face,
        [sx0, sy0, sx1, sy1, sx0, sy1],
        [p00.X + ox, p00.Y + oy, p11.X + ox, p11.Y + oy, p01.X + ox, p01.Y + oy]);
    }
  }

  return { canvas: out, w: ow, h: oh };
}

// ---------------------------------------------------------------------------
// 背景描画（§3.5）
// ---------------------------------------------------------------------------

function drawBackground(ctx, w, h, settings, bgImg) {
  const t = settings.bgType;
  if (t === 'transparent') return; // 何も描かない（市松はプレビュー側）
  if (t === 'solid') {
    ctx.fillStyle = settings.bgColor || '#ffffff';
    ctx.fillRect(0, 0, w, h);
  } else if (t === 'gradient') {
    const ang = ((settings.gradAngle || 0) * Math.PI) / 180;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const cx = w / 2, cy = h / 2;
    const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
    const grd = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
    grd.addColorStop(0, settings.gradA || '#4f46e5');
    grd.addColorStop(1, settings.gradB || '#ec4899');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  } else if (t === 'image' && bgImg && bgImg.width) {
    const f = fitRect(bgImg.width, bgImg.height, w, h, 'cover');
    ctx.drawImage(bgImg, f.sx, f.sy, f.sw, f.sh, f.dx, f.dy, f.dw, f.dh);
  }
}

// ---------------------------------------------------------------------------
// renderItem: item を最終 canvas に合成（§7）
// ---------------------------------------------------------------------------

/**
 * @param {object} item  Item（image/html）
 * @param {object} settings Settings
 * @param {number} rs レンダースケール（プレビュー小さめ / 書き出しは scale）
 * @param {number} N  ワープ格子分割数（プレビュー14 / 書き出し28）
 * @param {HTMLImageElement|null} bgImg 背景画像
 * @returns {HTMLCanvasElement}
 */
export function renderItem(item, settings, rs, N, bgImg) {
  const frame = getFrame(item.device);
  const face = drawFace(frame, item, settings, rs);
  const tilt = build3D(face.canvas, settings, N, rs, face.ro || 0);

  const dw = tilt.canvas.width;
  const dh = tilt.canvas.height;
  const shadow = settings.shadow ? Math.max(20, 40 * rs) * (settings.shadowStr ?? 0.55) : 0;
  // 余白 0 なら本当にフレームぴったり。影ONのときだけ影が切れないよう最小余白を足す。
  const margin = (settings.pad || 0) * rs + (settings.shadow ? shadow * 0.7 : 0);

  const outW = dw + margin * 2;
  const outH = dh + margin * 2;
  const out = makeCanvas(outW, outH);
  const ctx = out.getContext('2d');

  drawBackground(ctx, outW, outH, settings, bgImg);

  // 拡大率・位置オフセット（§3.9）。中心基準で拡大し、キャンバス比率でオフセット。
  const ds = settings.deviceScale || 1;
  const drawW = dw * ds;
  const drawH = dh * ds;
  const cx = outW / 2 + ((settings.offsetX || 0) / 100) * outW;
  const cy = outH / 2 + ((settings.offsetY || 0) / 100) * outH;
  const px = cx - drawW / 2;
  const py = cy - drawH / 2;

  if (settings.shadow) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(1, settings.shadowStr ?? 0.55))})`;
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = shadow * 0.35;
    ctx.drawImage(tilt.canvas, px, py, drawW, drawH);
    ctx.restore();
  } else {
    ctx.drawImage(tilt.canvas, px, py, drawW, drawH);
  }

  return out;
}

/**
 * 合成済み canvas を指定サイズ（書き出しプリセット）に収める（§8 / §3.9）。
 * 背景を敷き、モックアップを contain 配置。
 */
export function wrapToSize(src, outW, outH, settings, bgImg) {
  const c = makeCanvas(outW, outH);
  const ctx = c.getContext('2d');
  drawBackground(ctx, outW, outH, settings, bgImg);
  const margin = 0.06; // 内側余白 6%
  const boxW = outW * (1 - margin * 2);
  const boxH = outH * (1 - margin * 2);
  const scale = Math.min(boxW / src.width, boxH / src.height);
  const dw = src.width * scale;
  const dh = src.height * scale;
  ctx.drawImage(src, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
  return c;
}

// ---------------------------------------------------------------------------
// 書き出し（§3.6 PNG/JPG/SVG）
// ---------------------------------------------------------------------------

/**
 * canvas を Blob 化。JPG は透過を白地に、SVG はラスタ埋め込み（§14.7）。
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas, format, quality = 0.92) {
  if (format === 'jpg' || format === 'jpeg') {
    // 透過を白地化
    const c = makeCanvas(canvas.width, canvas.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, 0, 0);
    return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', quality));
  }
  if (format === 'svg') {
    const dataUrl = canvas.toDataURL('image/png');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" ` +
      `viewBox="0 0 ${canvas.width} ${canvas.height}">` +
      `<image width="${canvas.width}" height="${canvas.height}" href="${dataUrl}"/></svg>`;
    return Promise.resolve(new Blob([svg], { type: 'image/svg+xml' }));
  }
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
}
