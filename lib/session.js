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

export async function openSession({ url, width = 1440, height = 900 }) {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: Math.round(width), height: Math.round(height) }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await gotoSafe(page, url);
  const id = 's' + (seq++);
  const s = { context, page, last: Date.now() };
  sessions.set(id, s);
  return { id, ...(await snap(s)) };
}

async function applyEvent(page, e) {
  if (e.t === 'click') await page.mouse.click(e.x, e.y);
  else if (e.t === 'dblclick') await page.mouse.dblclick(e.x, e.y);
  else if (e.t === 'move') await page.mouse.move(e.x, e.y);
  else if (e.t === 'scroll') await page.mouse.wheel(e.dx || 0, e.dy || 0);
  else if (e.t === 'type') await page.keyboard.type(e.text, { delay: 0 });
  else if (e.t === 'key') await page.keyboard.press(e.key);
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
