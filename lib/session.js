// ============================================================================
// サーバー側インタラクティブ・ブラウザセッション（Playwright）
// iframe では取得できない「URLが変わらない操作後の画面状態」も、
// サーバー側の実ブラウザを操作してそのままスクショすることで撮影できる。
// ============================================================================

import { getBrowser } from './browser.js';

const sessions = new Map(); // id -> { context, page, last }
let seq = 1;
const IDLE_MS = 20 * 60 * 1000; // アイドル自動クローズまで（短すぎるとすぐ切れるので長め）
const TIMEOUT = 30000;

/** セッション切れ（クライアントが自動で開き直せるよう code を付ける）。 */
function sessionGone() {
  return Object.assign(new Error('セッションが切れました。もう一度開いてください'), { code: 'SESSION_GONE' });
}

/** 生きている session を取得。無い/ページが閉じていれば SESSION_GONE。 */
function liveSession(id) {
  const s = sessions.get(id);
  if (!s || (s.page.isClosed && s.page.isClosed())) { sessions.delete(id); throw sessionGone(); }
  return s;
}

async function gotoSafe(page, url) {
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT }); }
  catch { await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT }).catch(() => {}); }
}

/** ストリーム用（軽い JPEG）/ 撮影用（PNG）のスクショ＋現在URL。 */
async function snap(s, forCapture = false) {
  const buf = forCapture
    ? await s.page.screenshot({ type: 'png' })
    : await s.page.screenshot({ type: 'jpeg', quality: 72 });
  const mime = forCapture ? 'image/png' : 'image/jpeg';
  return { screenshot: `data:${mime};base64,${buf.toString('base64')}`, url: s.page.url() };
}

// スマホ・タブレットを撮る時に付ける UA（サイトにモバイル版を出させる）。
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';

function contextOpts({ width = 1440, height = 900, dpr = 2, mobile = false }) {
  return {
    viewport: { width: Math.round(width), height: Math.round(height) },
    deviceScaleFactor: Math.max(1, Math.min(4, dpr)),
    isMobile: !!mobile,
    hasTouch: !!mobile,
    userAgent: mobile ? MOBILE_UA : undefined,
  };
}

export async function openSession({ url, width = 1440, height = 900, dpr = 2, mobile = false }) {
  const browser = await getBrowser();
  const context = await browser.newContext(contextOpts({ width, height, dpr, mobile }));
  const page = await context.newPage();
  const id = 's' + (seq++);
  const s = { context, page, last: Date.now(), pendingChooser: null };
  // サイトがファイル選択を要求したら（<input type=file> クリック等）その chooser を掴んでおく。
  // リモートのOSダイアログは操作できないので、後でクライアントが選んだファイルを流し込む。
  page.on('filechooser', (fc) => { s.pendingChooser = fc; });
  sessions.set(id, s);
  await gotoSafe(page, url);
  return { id, ...(await snap(s)) };
}

// Mac の Cmd を含むショートカットは、リモート（Linux）ブラウザでは Control として送る。
function comboSeq(e) {
  const parts = [];
  if (e.ctrl) parts.push('Control');
  if (e.shift) parts.push('Shift');
  if (e.alt) parts.push('Alt');
  const k = e.key || '';
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join('+');
}

async function applyEvent(page, e) {
  if (e.t === 'click') await page.mouse.click(e.x, e.y);
  else if (e.t === 'dblclick') await page.mouse.dblclick(e.x, e.y);
  else if (e.t === 'move') await page.mouse.move(e.x, e.y);
  else if (e.t === 'scroll') await page.mouse.wheel(e.dx || 0, e.dy || 0);
  else if (e.t === 'type') await page.keyboard.type(e.text, { delay: 0 }); // IME確定後のテキストもここで入力
  else if (e.t === 'key') await page.keyboard.press(e.key);
  else if (e.t === 'combo') await page.keyboard.press(comboSeq(e)); // Cmd/Ctrl+A などの全選択・コピペ
  else if (e.t === 'nav') await gotoSafe(page, e.url);
  else if (e.t === 'back') await page.goBack({ timeout: TIMEOUT }).catch(() => {});
  else if (e.t === 'forward') await page.goForward({ timeout: TIMEOUT }).catch(() => {});
  else if (e.t === 'reload') await page.reload({ timeout: TIMEOUT }).catch(() => {});
}

export async function actSession({ id, events = [] }) {
  const s = liveSession(id);
  s.last = Date.now();
  s.pendingChooser = null; // この操作で新たにファイル選択が要求されたかを見るためリセット
  for (const e of events) { await applyEvent(s.page, e); }
  // クリック等で非同期処理（fetch / google.script.run など）が走ることが多いので、
  // ネットワークが落ち着くのを短時間待ってから撮影する（「接続中…」のまま止まらないように）。
  await s.page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
  await s.page.waitForTimeout(120).catch(() => {});
  // サイト側がファイル選択を求めていれば、クライアントに知らせてファイル選択を促す。
  return { ...(await snap(s)), fileChooser: !!s.pendingChooser };
}

/** 操作せず現在の画面だけ撮り直す（遅れて反映される非同期UIの追従用）。 */
export async function refreshSession({ id }) {
  const s = liveSession(id);
  s.last = Date.now();
  return snap(s);
}

/** 開き直さずに撮影サイズだけ変更（setViewportSize）。サイズ入力での再オープンを避ける。 */
export async function resizeSession({ id, width, height }) {
  const s = liveSession(id);
  s.last = Date.now();
  const w = Math.max(200, Math.min(4000, Math.round(width)));
  const h = Math.max(200, Math.min(4000, Math.round(height)));
  await s.page.setViewportSize({ width: w, height: h }).catch(() => {});
  await s.page.waitForTimeout(60).catch(() => {});
  return snap(s);
}

/**
 * ページ内の <input type="file"> にローカルのファイルをセットする（アップロード）。
 * リモートの実ブラウザのOSダイアログは操作できないので、要素へ直接ファイルを流し込む。
 * @param {{id:string, files:Array<{name:string,mimeType:string,buffer:Buffer}>}} p
 */
export async function uploadSession({ id, files }) {
  const s = liveSession(id);
  s.last = Date.now();
  const mapped = files.map((f) => ({ name: f.name, mimeType: f.mimeType || 'application/octet-stream', buffer: f.buffer }));
  const setFilesSafe = async (fn) => {
    try { await fn(mapped); }
    catch (e) { if (mapped.length > 1) await fn([mapped[0]]); else throw e; } // 単一選択には先頭1件で再試行
  };

  // 1) サイトの「ファイル選択」ボタンを押して開いた chooser があれば、その入力欄に流し込む（最優先・確実）。
  if (s.pendingChooser) {
    const fc = s.pendingChooser; s.pendingChooser = null;
    try {
      await setFilesSafe((m) => fc.setFiles(m));
      await s.page.waitForTimeout(250).catch(() => {});
      return snap(s);
    } catch {
      /* だめなら下のセレクタ方式にフォールバック */
    }
  }

  // 2) ページ内の <input type=file> を探して直接セット。
  const inputs = await s.page.$$('input[type=file]');
  if (!inputs.length) {
    throw Object.assign(new Error('このページにファイルの入力欄が見つかりませんでした。サイト側の「ファイルを選択」などのボタンを一度押してから、もう一度お試しください。'), { code: 'NO_FILE_INPUT' });
  }
  // 表示・操作可能なものを優先。無ければ最初の input[type=file]（多くは非表示だが有効）。
  let target = inputs[0];
  for (const h of inputs) {
    const visible = await h.isVisible().catch(() => false);
    const enabled = await h.isEnabled().catch(() => true);
    if (visible && enabled) { target = h; break; }
  }
  await setFilesSafe((m) => target.setInputFiles(m));
  await s.page.waitForTimeout(250).catch(() => {}); // プレビュー・自動アップロードの反映待ち
  return snap(s);
}

export async function shotSession({ id }) {
  const s = liveSession(id);
  s.last = Date.now();
  // フォント・描画の落ち着きを少し待ってから撮影
  await s.page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
  return snap(s, true);
}

/**
 * ステートレスな一発撮影（open→撮影→close を 1 リクエストで完結）。
 * サーバーレス（Vercel）はリクエストをまたいでセッションを保持できないため、
 * ライブ操作は使えないが「URLを開いて撮る」だけならこれで動く。
 */
export async function captureOnce({ url, width = 1440, height = 900, dpr = 2, mobile = false }) {
  const browser = await getBrowser();
  const context = await browser.newContext(contextOpts({ width, height, dpr, mobile }));
  try {
    const page = await context.newPage();
    await gotoSafe(page, url);
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
    await page.waitForTimeout(120).catch(() => {});
    const buf = await page.screenshot({ type: 'png' });
    return { screenshot: `data:image/png;base64,${buf.toString('base64')}`, url: page.url() };
  } finally {
    await context.close().catch(() => {});
  }
}

/** 実行環境でできること。interactive=ライブ操作可（＝常駐プロセスがある）。 */
export function capabilities() {
  const external = !!process.env.BROWSER_WS_ENDPOINT;
  const serverless = process.env.SERVERLESS === '1' || !!process.env.VERCEL;
  // サーバーレスはリクエスト間で page を保持できない → ライブ操作は不可（撮影のみ）。
  return { interactive: !serverless, external, serverless };
}

export async function closeSession(id) {
  const s = sessions.get(id);
  if (s) { await s.context.close().catch(() => {}); sessions.delete(id); }
}

// アイドルセッションの自動クリーンアップ
if (!globalThis.__mockupSessionSweeper) {
  globalThis.__mockupSessionSweeper = setInterval(() => {
    const now = Date.now();
    for (const [id, s] of sessions) {
      if (now - s.last > IDLE_MS) { s.context.close().catch(() => {}); sessions.delete(id); }
    }
  }, 60000);
}
