// ============================================================================
// POST /api/render → image/png（§6.1）
// URL は JSON、フォルダは multipart（ファイル同梱）。Node ランタイム。
// ============================================================================

import { NextResponse } from 'next/server';
import { renderToPng, contentTypeFor } from '@/lib/folder-render.js';

export const runtime = 'nodejs';
export const maxDuration = 60; // §14.6

const MAX_VIEWPORT = 3840; // §13

/** 任意のアプリトークン検証（§9）。APP_TOKEN 未設定なら常に通過。 */
function checkToken(req) {
  const expected = process.env.APP_TOKEN;
  if (!expected) return true;
  return req.headers.get('x-app-token') === expected;
}

function clampVp(v, def) {
  const n = Number(v) || def;
  return Math.max(1, Math.min(MAX_VIEWPORT, n));
}

export async function POST(req) {
  if (!checkToken(req)) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const ct = req.headers.get('content-type') || '';
  try {
    let opts;

    if (ct.includes('application/json')) {
      // URL モード
      const body = await req.json();
      opts = {
        mode: 'url',
        url: body.url,
        width: clampVp(body.width, 1440),
        height: clampVp(body.height, 900),
        deviceScaleFactor: body.deviceScaleFactor ?? 2,
        mobile: !!body.mobile,
        fullPage: !!body.fullPage,
        waitMs: Number(body.waitMs) || 0,
        selector: body.selector || null,
        waitForSelector: body.waitForSelector || null,
        scrollX: Number(body.scrollX) || 0,
        scrollY: Number(body.scrollY) || 0,
        emulate: body.emulate || {},
        hideConsent: !!body.hideConsent,
        injectCss: body.injectCss || null,
        injectJs: body.injectJs || null,
      };
    } else {
      // フォルダモード（multipart）
      const form = await req.formData();
      const files = form.getAll('files');
      const paths = form.getAll('paths');
      const filesMap = new Map();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const p = String(paths[i] ?? f.name);
        if (!f || typeof f.arrayBuffer !== 'function') continue;
        const bytes = Buffer.from(await f.arrayBuffer());
        filesMap.set(p, { bytes, contentType: contentTypeFor(p) });
      }
      let emulate = {};
      try { emulate = JSON.parse(form.get('emulate') || '{}'); } catch {}
      opts = {
        mode: 'folder',
        entry: form.get('entry') || 'index.html',
        filesMap,
        width: clampVp(form.get('width'), 1440),
        height: clampVp(form.get('height'), 900),
        deviceScaleFactor: Number(form.get('deviceScaleFactor')) || 2,
        mobile: form.get('mobile') === 'true',
        fullPage: form.get('fullPage') === 'true',
        waitMs: Number(form.get('waitMs')) || 0,
        selector: form.get('selector') || null,
        waitForSelector: form.get('waitForSelector') || null,
        emulate,
      };
    }

    const png = await renderToPng(opts);
    return new NextResponse(png, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'レンダリングに失敗しました' }, { status: 500 });
  }
}
