// ============================================================================
// Playwright 起動（ローカル / SERVERLESS 切替）§3.4 / §14.6
// ブラウザは常駐（ウォーム）。context は呼び出し側で毎回生成→close。
// ============================================================================

let _browserPromise = null;

async function launch() {
  // 外部ブラウザ（browserless / Browserbase など）に WebSocket 接続。
  // Vercel でブラウザを確実に動かす最も堅い方法（バイナリ同梱・サイズ制限・chromium互換の問題を回避）。
  // 例: BROWSER_WS_ENDPOINT="wss://production-sfo.browserless.io/playwright?token=XXXX"
  if (process.env.BROWSER_WS_ENDPOINT) {
    const { chromium } = await import('playwright-core');
    return chromium.connect(process.env.BROWSER_WS_ENDPOINT);
  }
  // Vercel 上では VERCEL 環境変数が自動で入るのでサーバーレス構成を自動選択。
  // ローカルで強制したい場合は SERVERLESS=1。
  if (process.env.SERVERLESS === '1' || process.env.VERCEL) {
    // Vercel 等サーバーレス: playwright-core + @sparticuz/chromium
    const chromiumPkg = (await import('@sparticuz/chromium')).default;
    const { chromium } = await import('playwright-core');
    return chromium.launch({
      args: chromiumPkg.args,
      executablePath: await chromiumPkg.executablePath(),
      headless: true,
    });
  }
  // ローカル: フル playwright（自前の chromium を使用）
  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true });
}

/** 常駐ブラウザを取得（切断時は再起動）。 */
export async function getBrowser() {
  if (_browserPromise) {
    try {
      const b = await _browserPromise;
      if (b.isConnected()) return b;
    } catch {
      /* 落ちていたら作り直す */
    }
  }
  _browserPromise = launch();
  return _browserPromise;
}
