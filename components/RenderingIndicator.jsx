'use client';

import { useEffect, useState } from 'react';

/** レンダリング中の状態表示（目安時間＋経過秒＋進捗バー）§4.1。 */
export default function RenderingIndicator({ estimate = 5, label = 'レンダリング中', note = '' }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const pct = Math.min(96, Math.round((sec / estimate) * 100));
  return (
    <div className="render-ind" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <div className="render-ind-txt">{label}…</div>
      <div className="render-ind-sub">目安 約{estimate}秒{sec > 0 ? `（${sec}秒経過）` : ''}</div>
      <div className="render-bar"><div style={{ width: `${Math.max(8, pct)}%` }} /></div>
      {note && <div className="render-ind-sub">{note}</div>}
      {sec > estimate + 4 && <div className="render-ind-sub">初回はブラウザの起動などで少し時間がかかります…</div>}
    </div>
  );
}
