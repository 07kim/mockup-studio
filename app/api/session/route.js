// ============================================================================
// POST /api/session — インタラクティブ・ブラウザセッション操作
// action: open / act / shot / close
// ============================================================================

import { NextResponse } from 'next/server';
import { openSession, actSession, resizeSession, shotSession, closeSession, captureOnce, capabilities } from '@/lib/session.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

// 実行環境の能力（ライブ操作が可能か）をクライアントに知らせる。
export function GET() {
  return NextResponse.json(capabilities());
}

export async function POST(req) {
  try {
    const body = await req.json();
    switch (body.action) {
      case 'open': return NextResponse.json(await openSession(body));
      case 'act': return NextResponse.json(await actSession(body));
      case 'resize': return NextResponse.json(await resizeSession(body));
      case 'shot': return NextResponse.json(await shotSession(body));
      case 'capture': return NextResponse.json(await captureOnce(body)); // 一発撮影（サーバーレス対応）
      case 'close': await closeSession(body.id); return NextResponse.json({ ok: true });
      default: return NextResponse.json({ error: '不明な操作です' }, { status: 400 });
    }
  } catch (e) {
    // SESSION_GONE はクライアントが自動で開き直せるよう 409＋code で返す。
    const gone = e?.code === 'SESSION_GONE';
    return NextResponse.json({ error: e?.message || 'セッションエラー', code: e?.code }, { status: gone ? 409 : 500 });
  }
}
