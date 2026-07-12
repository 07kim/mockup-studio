'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { viewportFor } from '@/lib/render-client.js';
import { framesByGroup } from '@/lib/devices.js';
import ItemCanvas from './ItemCanvas.jsx';
import RenderingIndicator from './RenderingIndicator.jsx';

async function api(action, body) {
  const res = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'セッションエラー');
  return res.json();
}

const KEYMAP = { Enter: 'Enter', Backspace: 'Backspace', Delete: 'Delete', Tab: 'Tab', Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Home: 'Home', End: 'End' };

/**
 * URL 操作ステージ（サーバー側 Playwright を遠隔操作）。
 * クリック・入力・スクロールをサーバーの実ブラウザに転送し、
 * 「今表示されている実際の状態」をそのまま撮影する（URLが変わらない画面も撮れる）。
 */
export default function UrlStage(props) {
  const { session, onSessionChange, onCapture, onClose, previewItem, previewSettings, bgImg, version, pushToast } = props;
  const vp = viewportFor(session.device, session.orientation);
  const groups = framesByGroup();

  const [shot, setShot] = useState(null);
  const [url, setUrl] = useState(session.url);
  const [addr, setAddr] = useState(session.url);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [count, setCount] = useState(0);

  const sidRef = useRef(null);
  const imgRef = useRef(null);
  const queue = useRef([]);
  const running = useRef(false);
  const wheelAccum = useRef({ dy: 0, t: null });

  // セッション開始（URL / デバイス変更で開き直す）
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null); setShot(null); setCount(0);
    api('open', { url: session.url, width: vp.w, height: vp.h })
      .then((r) => { if (!alive) return; sidRef.current = r.id; setShot(r.screenshot); setUrl(r.url); setAddr(r.url); setLoading(false); })
      .catch((e) => { if (!alive) return; setError(e.message); setLoading(false); });
    return () => {
      alive = false;
      const id = sidRef.current; sidRef.current = null;
      if (id) api('close', { id }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.url, session.device, vp.w, vp.h]);

  const pump = useCallback(async () => {
    if (running.current || !sidRef.current) return;
    running.current = true;
    while (queue.current.length) {
      const events = queue.current.splice(0, queue.current.length);
      setBusy(true);
      try { const r = await api('act', { id: sidRef.current, events }); setShot(r.screenshot); setUrl(r.url); setAddr(r.url); }
      catch (e) { setError(e.message); }
    }
    running.current = false; setBusy(false);
  }, []);

  const enqueue = useCallback((...events) => { queue.current.push(...events); pump(); }, [pump]);

  const onImgClick = (e) => {
    const r = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * vp.w;
    const y = ((e.clientY - r.top) / r.height) * vp.h;
    enqueue({ t: 'click', x, y });
  };

  const onWheel = (e) => {
    wheelAccum.current.dy += e.deltaY;
    clearTimeout(wheelAccum.current.t);
    wheelAccum.current.t = setTimeout(() => {
      const dy = wheelAccum.current.dy; wheelAccum.current.dy = 0;
      enqueue({ t: 'scroll', dy });
    }, 110);
  };

  const onKeyDown = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length === 1) { e.preventDefault(); enqueue({ t: 'type', text: e.key }); }
    else if (KEYMAP[e.key]) { e.preventDefault(); enqueue({ t: 'key', key: KEYMAP[e.key] }); }
  };

  const go = () => { let u = addr.trim(); if (!u) return; if (!/^https?:\/\//i.test(u)) { try { u = new URL(u, session.url).href; } catch {} } enqueue({ t: 'nav', url: u }); };

  const capture = async () => {
    if (!sidRef.current) return;
    setBusy(true);
    try {
      const r = await api('shot', { id: sidRef.current });
      onCapture(r.screenshot, r.url || url, session.device);
      setCount((c) => c + 1);
    } catch (e) { pushToast?.({ kind: 'err', message: `撮影失敗: ${e.message}` }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="urlbar">
        <div className="seg">
          <button onClick={() => enqueue({ t: 'back' })} title="戻る">←</button>
          <button onClick={() => enqueue({ t: 'forward' })} title="進む">→</button>
          <button onClick={() => enqueue({ t: 'reload' })} title="再読み込み">⟳</button>
        </div>
        <input className="addr-input" value={addr} placeholder="https://…" aria-label="アドレス"
          onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
        <button className="btn sm" onClick={go}>移動</button>
        <select value={session.device} onChange={(e) => onSessionChange({ ...session, device: e.target.value })} aria-label="デバイス" title="撮影するデバイス">
          {groups.map((g) => <optgroup key={g.group} label={g.group}>{g.items.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>)}
        </select>
        <button className="cap" onClick={capture} disabled={loading || !!error}>＋ この画面を追加{count > 0 ? `（${count}）` : ''}</button>
        <button className="btn sm" onClick={onClose}>完了</button>
      </div>

      <div className="url-body">
        <div className="sess-wrap" tabIndex={0} onWheel={onWheel} onKeyDown={onKeyDown}
          onClick={() => { /* フォーカス取得 */ }}>
          {loading ? <RenderingIndicator estimate={6} label="サイトを開いています" />
            : error ? <div className="stage-empty"><p style={{ color: 'var(--danger)' }}>{error}</p></div>
            : shot ? (
              <img ref={imgRef} className="sess-img" src={shot} alt="操作中の画面" draggable={false}
                style={{ aspectRatio: `${vp.w} / ${vp.h}` }} onClick={onImgClick} />
            ) : null}
          {busy && !loading && <div className="sess-busy"><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /></div>}
        </div>

        <div className="url-thumb">
          <div className="url-thumb-cap">プレビュー{count > 0 ? '（直近に追加）' : ''}</div>
          <div className="url-thumb-body">
            {previewItem?.img ? <ItemCanvas item={previewItem} settings={previewSettings} bgImg={bgImg} rs={0.5} N={10} version={version} />
              : <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>「追加」で撮影</span>}
          </div>
        </div>
      </div>

      <div className="embed-note">
        画面の中をクリック・入力・スクロールできます。入力やボタンで見た目が変わった状態も、その場で「＋ この画面を追加」で撮影できます（URLが変わらなくてもOK）。日本語入力（IME）は未対応です。
      </div>
    </>
  );
}
