'use client';

import { useState, useRef, useEffect } from 'react';
import { fileToImage } from '@/lib/import.js';

const BGS = [['transparent', 'なし'], ['solid', '単色'], ['gradient', 'グラデ'], ['image', '画像']];
const LBL = { transparent: 'なし', solid: '単色', gradient: 'グラデ', image: '画像' };

/**
 * 中央プレビュー左下の背景ボタン＋ポップオーバー。
 * モックアップで背景は使わないことが多いので右パネルからは外し、必要な時だけここで設定する。
 */
export default function BgControl({ settings, onChange, onSetBg }) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);
  const wrapRef = useRef(null);
  const set = (p) => onChange(p);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleBg = async (file) => { if (!file) return; try { const { img } = await fileToImage(file); onSetBg(img); } catch { /* 無視 */ } };
  const active = settings.bgType && settings.bgType !== 'transparent';

  return (
    <div className="bgctl" ref={wrapRef}>
      {open && (
        <div className="bgpop">
          <div className="bgpop-title">背景</div>
          <div className="seg full">
            {BGS.map(([v, l]) => <button key={v} className={settings.bgType === v ? 'on' : ''} onClick={() => set({ bgType: v })}>{l}</button>)}
          </div>
          {settings.bgType === 'solid' && (
            <div className="row" style={{ marginTop: 10 }}>
              <input type="color" className="color" value={settings.bgColor} onChange={(e) => set({ bgColor: e.target.value })} />
              <input type="text" value={settings.bgColor} onChange={(e) => set({ bgColor: e.target.value })} />
            </div>
          )}
          {settings.bgType === 'gradient' && (
            <div style={{ marginTop: 10 }}>
              <div className="row"><input type="color" className="color" value={settings.gradA} onChange={(e) => set({ gradA: e.target.value })} /><input type="color" className="color" value={settings.gradB} onChange={(e) => set({ gradB: e.target.value })} /></div>
              <div className="row" style={{ marginTop: 10 }}>
                <span className="val">角度</span>
                <input type="range" min={0} max={360} value={settings.gradAngle} onChange={(e) => set({ gradAngle: +e.target.value })} style={{ flex: 1 }} />
                <span className="val" style={{ width: 36, textAlign: 'right' }}>{settings.gradAngle}°</span>
              </div>
            </div>
          )}
          {settings.bgType === 'image' && (
            <div style={{ marginTop: 10 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleBg(e.target.files?.[0])} />
              <button className="btn sm" style={{ width: '100%' }} onClick={() => fileRef.current?.click()}>背景画像を選ぶ</button>
            </div>
          )}
        </div>
      )}
      <button className={`bgctl-btn${active ? ' on' : ''}`} onClick={() => setOpen((o) => !o)} title="背景を設定" aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 16l5-4 4 3 3-2 6 5" /><circle cx="8.5" cy="9" r="1.3" />
        </svg>
        <span>背景：{LBL[settings.bgType] || 'なし'}</span>
      </button>
    </div>
  );
}
