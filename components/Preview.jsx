'use client';

import { useState, useRef } from 'react';
import ItemCanvas from './ItemCanvas.jsx';
import RenderingIndicator from './RenderingIndicator.jsx';
import BgControl from './BgControl.jsx';

const PREVIEW_RS = 0.9;
const PREVIEW_N = 14;
const clampDeg = (v) => Math.max(-60, Math.min(60, Math.round(v)));

/** 中央フォーカスプレビュー（§4 / §7）。傾きモードではドラッグで自由に回転できる。 */
export default function Preview({ item, settings, bgImg, version, warnCount, onAddImage, onChange, onSetBg }) {
  const [tilt, setTilt] = useState(false); // 傾きモード（ドラッグで回転）
  const drag = useRef(null);
  const raf = useRef(0);
  const pending = useRef(null);

  const onPointerDown = (e) => {
    if (!tilt) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, rotY: settings.rotY || 0, rotX: settings.rotX || 0 };
  };
  const onPointerMove = (e) => {
    if (!tilt || !drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    // ドラッグした側の縁が奥へ倒れる自然な回転（左右と上下で挙動をそろえる）。
    // 右へ=右辺が奥 / 下へ=下辺が奥。
    pending.current = { rotY: clampDeg(drag.current.rotY + dx * 0.3), rotX: clampDeg(drag.current.rotX - dy * 0.3) };
    if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; if (pending.current) onChange(pending.current); });
  };
  const endDrag = () => { drag.current = null; };
  const onDblClick = () => { if (tilt) onChange({ rotX: 0, rotY: 0 }); };

  if (!item) {
    return (
      <div className="stage-body">
        <button className="hero-drop" onClick={onAddImage}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
          </svg>
          <strong>画像をドラッグ＆ドロップ</strong>
          <span>または クリックして画像を選ぶ</span>
          <span className="sub">スクリーンショットを入れると、自動でスマホ／PCフレームに合成します</span>
        </button>
      </div>
    );
  }
  if (item.loading) return <div className="stage-body"><RenderingIndicator estimate={6} /></div>;
  if (item.error) return <div className="stage-body"><div className="stage-empty"><p style={{ color: 'var(--danger)' }}>失敗: {item.error}</p><p>カードの「再描画」で再試行できます。</p></div></div>;

  return (
    <div className="stage-body">
      <div className={`checker${tilt ? ' tilt-on' : ''}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag} onDoubleClick={onDblClick}>
        <ItemCanvas item={item} settings={settings} bgImg={bgImg} rs={PREVIEW_RS} N={PREVIEW_N} version={version} />
      </div>

      {/* 左下: 背景（枠色は上部のデバイスツールバーへ） */}
      <div className="pv-bl">
        <BgControl settings={settings} onChange={onChange} onSetBg={onSetBg} />
      </div>

      {/* 右下: 傾きモード（ドラッグで自由に回転） */}
      <div className="pv-br">
        <button className={`bgctl-btn${tilt ? ' on' : ''}`} onClick={() => setTilt((t) => !t)} title="ドラッグで自由に傾ける（細かい数値は右パネル）">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8l8-4 8 4-8 4-8-4z" /><path d="M4 8v8l8 4 8-4V8" /><path d="M12 12v8" />
          </svg>
          <span>傾き{tilt ? '：ドラッグ中' : ''}</span>
        </button>
      </div>

      {tilt && <div className="tilt-hint">ドラッグで回転 ・ ダブルクリックで正面に戻す（厚み・遠近は右パネルで）</div>}

      <div className="stage-tools">
        <span style={{ color: 'var(--ink)', fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
        {warnCount > 0 && <span className="warn-txt">警告 {warnCount}件</span>}
      </div>
    </div>
  );
}
