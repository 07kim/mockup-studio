// ============================================================================
// サーバー側インタラクティブ・ブラウザセッション（Playwright）
// iframe では取得できない「URLが変わらない操作後の画面状態」も、
// サーバー側の実ブラウザを操作してそのままスクショすることで撮影できる。
// ============================================================================

import { getBrowser } from './browser.js';

const sessions = new Map(); // id -> { context, page, last }
let seq = 1;
const IDLE_MS = 5 * 60 * 1000;
const TIMEOUT = 30000;

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
  await gotoSafe(page, url);
  const id = 's' + (seq++);
  const s = { context, page, last: Date.now() };
  sessions.set(id, s);
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
  const s = sessions.get(id);
  if (!s) throw new Error('セッションが切れました。もう一度開いてください');
  s.last = Date.now();
  for (const e of events) { await applyEvent(s.page, e); }
  await s.page.waitForTimeout(80).catch(() => {});
  return snap(s);
}

export async function shotSession({ id }) {
  const s = sessions.get(id);
  if (!s) throw new Error('セッションが切れました');
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
