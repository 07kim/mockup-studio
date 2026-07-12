// ============================================================================
// POST /api/session — インタラクティブ・ブラウザセッション操作
// action: open / act / shot / close
// ============================================================================

import { NextResponse } from 'next/server';
import { openSession, actSession, shotSession, closeSession } from '@/lib/session.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json();
    switch (body.action) {
      case 'open': return NextResponse.json(await openSession(body));
      case 'act': return NextResponse.json(await actSession(body));
      case 'shot': return NextResponse.json(await shotSession(body));
      case 'close': await closeSession(body.id); return NextResponse.json({ ok: true });
      default: return NextResponse.json({ error: '不明な操作です' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'セッションエラー' }, { status: 500 });
  }
}
