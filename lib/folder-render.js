// ============================================================================
// レンダラ本体（§3.4 / §6.4）: URL / フォルダ（リクエスト傍受でメモリ配信）→ PNG Buffer
// 一時ファイル・ポート・常駐サーバ不要。ローカルでもサーバーレスでも同一コード。
// ============================================================================

import { getBrowser } from './browser.js';

const RENDER_TIMEOUT = 30000; // §13
const MAX_WAIT = 10000; // waitMs 上限（§13）
const VIRTUAL_ORIGIN = 'https://mockup.local/';

/** 拡張子から Content-Type を推定。 */
export function contentTypeFor(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  const map = {
    html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
    mjs: 'text/javascript; charset=utf-8', json: 'application/json',
    svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
    map: 'application/json', txt: 'text/plain; charset=utf-8', xml: 'application/xml',
    webmanifest: 'application/manifest+json', mp4: 'video/mp4', webm: 'video/webm',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * 指定ビューポートで URL / フォルダをキャプチャして PNG Buffer を返す。
 * @param {object} opts
 *   mode: 'url' | 'folder'
 *   url?: string
 *   entry?: string            (folder: 開始ファイル)
 *   filesMap?: Map<path, {bytes:Buffer, contentType:string}>  (folder)
 *   width, height             (viewport)
 *   deviceScaleFactor?: number(既定2)
 *   fullPage?, waitMs?, selector?, waitForSelector?
 *   emulate?: { colorScheme?, locale?, timezone?, reducedMotion? }
 *   hideConsent?: boolean     (よくある同意バナーを隠す)
 *   injectCss?, injectJs?
 * @returns {Promise<Buffer>}
 */
export async function renderToPng(opts) {
  const {
    mode, url, entry = 'index.html', filesMap,
    width = 1440, height = 900, deviceScaleFactor = 2, mobile = false,
    fullPage = false, waitMs = 0, selector = null, waitForSelector = null,
    emulate = {}, hideConsent = false, injectCss = null, injectJs = null,
  } = opts;

  // スマホ・タブレット撮影時はモバイルUAを付けてサイトにモバイル版を出させる。
  const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: Math.round(width), height: Math.round(height) },
    deviceScaleFactor: Math.max(1, Math.min(4, deviceScaleFactor)),
    isMobile: !!mobile,
    hasTouch: !!mobile,
    userAgent: mobile ? MOBILE_UA : undefined,
    colorScheme: emulate.colorScheme === 'dark' ? 'dark' : 'light',
    locale: emulate.locale || undefined,
    timezoneId: emulate.timezone || undefined,
    reducedMotion: emulate.reducedMotion ? 'reduce' : undefined,
  });

  const page = await context.newPage();
  try {
    if (mode === 'folder') {
      if (!filesMap || filesMap.size === 0) throw new Error('フォルダにファイルがありません');
      await context.route('**/*', (route) => {
        try {
          const u = new URL(route.request().url());
          if (u.origin !== 'https://mockup.local') return route.continue(); // 外部CDN等は素通し
          let key = decodeURIComponent(u.pathname.replace(/^\//, ''));
          if (key === '' || key.endsWith('/')) key += 'index.html';
          const file =
            filesMap.get(key) ||
            filesMap.get(key + '/index.html') ||
            filesMap.get(key + '.html');
          if (file) route.fulfill({ body: file.bytes, contentType: file.contentType });
          else route.fulfill({ status: 404, body: 'Not Found' });
        } catch {
          route.continue();
        }
      });
      const target = VIRTUAL_ORIGIN + String(entry).replace(/^\//, '');
      await gotoSafe(page, target);
    } else {
      if (!url) throw new Error('URL が指定されていません');
      await gotoSafe(page, url);
    }

    // Web フォント読込待ち（文字ズレ防止・§3.4）
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});

    if (hideConsent) await tryHideConsent(page);
    if (injectCss) await page.addStyleTag({ content: injectCss }).catch(() => {});
    if (injectJs) await page.evaluate((code) => { try { new Function(code)(); } catch {} }, injectJs).catch(() => {});

    if (waitForSelector) await page.waitForSelector(waitForSelector, { timeout: MAX_WAIT }).catch(() => {});
    if (waitMs) await page.waitForTimeout(Math.min(waitMs, MAX_WAIT));

    // スクロール位置の再現（URL 操作で「この表示で取り込む」用）
    if (opts.scrollX || opts.scrollY) {
      await page.evaluate(({ x, y }) => window.scrollTo(x, y), { x: opts.scrollX || 0, y: opts.scrollY || 0 }).catch(() => {});
      await page.waitForTimeout(120);
    }

    let buf;
    if (selector) {
      const el = await page.$(selector);
      buf = el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png', fullPage });
    } else {
      buf = await page.screenshot({ type: 'png', fullPage: !!fullPage });
    }
    return buf;
  } finally {
    await context.close();
  }
}

async function gotoSafe(page, target) {
  try {
    await page.goto(target, { waitUntil: 'networkidle', timeout: RENDER_TIMEOUT });
  } catch {
    // networkidle 失敗時は load で再試行（§3.4）
    await page.goto(target, { waitUntil: 'load', timeout: RENDER_TIMEOUT });
  }
}

/** よくある同意バナー/ポップアップを閉じる or 隠す（任意・§3.4）。 */
async function tryHideConsent(page) {
  await page.evaluate(() => {
    const sel = [
      '[id*="cookie" i]', '[class*="cookie" i]', '[id*="consent" i]', '[class*="consent" i]',
      '[aria-label*="cookie" i]', '.cc-window', '#onetrust-banner-sdk',
    ];
    for (const s of sel) {
      document.querySelectorAll(s).forEach((el) => {
        const t = (el.textContent || '').toLowerCase();
        if (t.includes('cookie') || t.includes('consent') || t.includes('同意')) el.style.display = 'none';
      });
    }
  }).catch(() => {});
}
