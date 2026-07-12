'use client';

import { useState, useRef, useEffect } from 'react';
import { COLOR_PRESETS } from '@/lib/defaults.js';

/**
 * 中央プレビュー左下の「枠色」ボタン＋ポップオーバー。
 * プログラム型フレームのみ有効（写実PNG枠は色が効かないので呼び出し側で非表示）。
 */
export default function FrameColorControl({ settings, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const set = (p) => onChange(p);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const name = COLOR_PRESETS.find((p) => p.color === settings.frameColor)?.name || 'カスタム';

  return (
    <div className="bgctl" ref={wrapRef}>
      {open && (
        <div className="bgpop" style={{ width: 210 }}>
          <div className="bgpop-title">フレームの色</div>
          <div className="swatches">
            {COLOR_PRESETS.map((p) => (
              <button key={p.color} className={`sw${settings.frameColor === p.color ? ' on' : ''}`} style={{ background: p.color }} title={p.name} aria-label={p.name} onClick={() => set({ frameColor: p.color })} />
            ))}
            <input type="color" className="color" style={{ width: 24, height: 24 }} value={settings.frameColor} onChange={(e) => set({ frameColor: e.target.value })} aria-label="その他の色" title="その他の色" />
          </div>
        </div>
      )}
      <button className="bgctl-btn" onClick={() => setOpen((o) => !o)} title="フレームの色" aria-expanded={open}>
        <span className="fcc-dot" style={{ background: settings.frameColor }} />
        <span>枠色：{name}</span>
      </button>
    </div>
  );
}
