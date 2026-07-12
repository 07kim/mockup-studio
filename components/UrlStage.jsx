'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { framesByGroup, captureViewportFor } from '@/lib/devices.js';
import ItemCanvas from './ItemCanvas.jsx';
import RenderingIndicator from './RenderingIndicator.jsx';

async function api(action, body) {
  const res = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'セッションエラー');
  return res.json();
}

const KEYMAP = { Enter: 'Enter', Backspace: 'Backspace', Delete: 'Delete', Tab: 'Tab', Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Home: 'Home', End: 'End' };
// 転送する編集ショートカット（全選択・コピペ・取り消し系）。Cmd/Ctrl どちらでも受ける。
const COMBO_KEYS = new Set(['a', 'c', 'x', 'z', 'y']);

// ブラウザ起動失敗（サーバーレス環境で Chromium が動かない等）を分かりやすく案内。
function friendlyErr(msg) {
  const m = String(msg || '');
  if (/libnss3|shared librar|Executable doesn't exist|Failed to launch|browserType\.launch|Target page|chromium|connect/i.test(m)) {
    return 'この環境ではブラウザ起動に失敗しました。外部ブラウザ（BROWSER_WS_ENDPOINT）を設定するか、ローカル版（npm run dev）でご利用ください。画像やフォルダの取り込みはそのまま使えます。';
  }
  return m;
}

/**
 * URL 操作ステージ（サーバー側 Playwright を遠隔操作）。
 * - interactive環境（ローカル/常駐）: クリック・入力・スクロール・IME・ショートカットを転送。
 * - 非interactive環境（Vercel等サーバーレス）: 「URLを開いて撮影」だけの一発撮影モード。
 */
export default function UrlStage(props) {
  const { session, onSessionChange, onCapture, onClose, previewItem, previewSettings, bgImg, version, pushToast } = props;
  // 撮影ビューポート = デバイスの CSS 論理サイズ＋DPR（DevTools のデバイスモード相当）。
  // これで幅が小さくなり、サイトがスマホUIで表示される。session.vw/vh があれば上書き（任意）。
  const cap = captureViewportFor(session.device, session.orientation);
  const vp = (session.vw && session.vh)
    ? { w: Math.round(session.vw), h: Math.round(session.vh), dpr: cap.dpr, mobile: cap.mobile }
    : cap;
  const groups = framesByGroup();
  const customSize = !!(session.vw && session.vh);

  const [interactive, setInteractive] = useState(null); // null=判定中 / true=操作可 / false=撮影のみ
  const [shot, setShot] = useState(null);
  const [url, setUrl] = useState(session.url);
  const [addr, setAddr] = useState(session.url);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [count, setCount] = useState(0);

  const sidRef = useRef(null);
  const imgRef = useRef(null);
  const imeRef = useRef(null);        // IME/キー入力を受ける隠しinput
  const composing = useRef(false);    // IME変換中フラグ
  const queue = useRef([]);
  const running = useRef(false);
  const wheelAccum = useRef({ dy: 0, t: null });

  // 実行環境の能力を取得（ライブ操作が可能か）。
  useEffect(() => {
    let alive = true;
    fetch('/api/session').then((r) => r.json())
      .then((c) => { if (alive) setInteractive(!!c.interactive); })
      .catch(() => { if (alive) setInteractive(true); }); // 取得失敗時はローカル想定
    return () => { alive = false; };
  }, []);

  // セッション開始 / 一発撮影（URL・デバイス・環境判定の変化で開き直す）
  useEffect(() => {
    if (interactive === null) return undefined; // 判定待ち
    let alive = true;
    setLoading(true); setError(null); setShot(null); setCount(0);

    if (interactive) {
      api('open', { url: session.url, width: vp.w, height: vp.h, dpr: vp.dpr, mobile: vp.mobile })
        .then((r) => { if (!alive) return; sidRef.current = r.id; setShot(r.screenshot); setUrl(r.url); setAddr(r.url); setLoading(false); })
        .catch((e) => { if (!alive) return; setError(friendlyErr(e.message)); setLoading(false); });
      return () => {
        alive = false;
        const id = sidRef.current; sidRef.current = null;
        if (id) api('close', { id }).catch(() => {});
      };
    }
    // 撮影のみモード
    api('capture', { url: session.url, width: vp.w, height: vp.h, dpr: vp.dpr, mobile: vp.mobile })
      .then((r) => { if (!alive) return; setShot(r.screenshot); setUrl(r.url); setAddr(r.url); setLoading(false); })
      .catch((e) => { if (!alive) return; setError(friendlyErr(e.message)); setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, session.url, session.device, vp.w, vp.h]);

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
    if (!interactive) return;
    const r = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * vp.w;
    const y = ((e.clientY - r.top) / r.height) * vp.h;
    enqueue({ t: 'click', x, y });
    imeRef.current?.focus(); // クリック後はキーボード入力を受け取れるようにする
  };

  const onWheel = (e) => {
    if (!interactive) return;
    wheelAccum.current.dy += e.deltaY;
    clearTimeout(wheelAccum.current.t);
    wheelAccum.current.t = setTimeout(() => {
      const dy = wheelAccum.current.dy; wheelAccum.current.dy = 0;
      enqueue({ t: 'scroll', dy });
    }, 110);
  };

  // --- キーボード／IME（隠しinput 経由） ---
  const onCompositionStart = () => { composing.current = true; };
  const onCompositionEnd = (e) => {
    composing.current = false;
    const text = e.data || '';
    if (text) enqueue({ t: 'type', text }); // 確定した日本語などをまとめて入力
    if (imeRef.current) imeRef.current.value = '';
  };
  const onBeforeInput = (e) => {
    if (composing.current) return;               // IME中は compositionend で送る
    if (e.inputType === 'insertText' && e.data) { // 通常文字（英数・記号）
      e.preventDefault();
      enqueue({ t: 'type', text: e.data });
    }
  };
  const onPaste = (e) => {
    const text = e.clipboardData?.getData('text');
    if (text) { e.preventDefault(); enqueue({ t: 'type', text }); } // ローカルのクリップボードを貼り付け
  };
  const onKeyDown = (e) => {
    if (composing.current) return; // 変換中の Enter 等は無視（確定は compositionend が拾う）
    if (e.metaKey || e.ctrlKey) {
      const k = e.key.toLowerCase();
      if (COMBO_KEYS.has(k)) { e.preventDefault(); enqueue({ t: 'combo', key: k, ctrl: true, shift: e.shiftKey }); }
      return; // それ以外の Cmd/Ctrl 系はブラウザ既定に任せない（何もしない）
    }
    if (KEYMAP[e.key]) { e.preventDefault(); enqueue({ t: 'key', key: KEYMAP[e.key] }); }
    // 通常文字は beforeinput / compositionend が担当するのでここでは送らない
  };

  const go = () => {
    let u = addr.trim(); if (!u) return;
    if (!/^https?:\/\//i.test(u)) { try { u = new URL(u, session.url).href; } catch { /* そのまま */ } }
    if (interactive) { enqueue({ t: 'nav', url: u }); return; }
    // 撮影のみモード: 新しい URL を撮り直す
    setLoading(true); setError(null);
    api('capture', { url: u, width: vp.w, height: vp.h, dpr: vp.dpr, mobile: vp.mobile })
      .then((r) => { setShot(r.screenshot); setUrl(r.url); setAddr(r.url); setLoading(false); })
      .catch((e) => { setError(friendlyErr(e.message)); setLoading(false); });
  };

  const capture = async () => {
    setBusy(true);
    try {
      if (interactive && sidRef.current) {
        const r = await api('shot', { id: sidRef.current });
        onCapture(r.screenshot, r.url || url, session.device);
      } else if (shot) {
        onCapture(shot, url, session.device); // 撮影のみモードは表示中のPNGをそのまま追加
      }
      setCount((c) => c + 1);
    } catch (e) { pushToast?.({ kind: 'err', message: `撮影失敗: ${e.message}` }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="urlbar">
        {interactive !== false && (
          <div className="seg">
            <button onClick={() => enqueue({ t: 'back' })} title="戻る">←</button>
            <button onClick={() => enqueue({ t: 'forward' })} title="進む">→</button>
            <button onClick={() => enqueue({ t: 'reload' })} title="再読み込み">⟳</button>
          </div>
        )}
        <input className="addr-input" value={addr} placeholder="https://…" aria-label="アドレス"
          onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
        <button className="btn sm" onClick={go}>{interactive === false ? '撮影' : '移動'}</button>
        <select value={session.device} onChange={(e) => onSessionChange({ ...session, device: e.target.value, vw: null, vh: null })} aria-label="デバイス" title="撮影するデバイス">
          {groups.map((g) => <optgroup key={g.group} label={g.group}>{g.items.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>)}
        </select>
        {/* 撮影サイズ（普段は意識しなくてOK・必要なら変更）。デバイスを選ぶと既定に戻る。 */}
        <span className={`url-size${customSize ? ' custom' : ''}`} title="撮影サイズ（幅×高 px）。通常はデバイスにおまかせ。変えたい時だけ入力">
          <input type="number" min={200} max={4000} value={vp.w}
            onChange={(e) => onSessionChange({ ...session, vw: +e.target.value || vp.w, vh: vp.h })} aria-label="幅(px)" />
          <span className="x">×</span>
          <input type="number" min={200} max={4000} value={vp.h}
            onChange={(e) => onSessionChange({ ...session, vw: vp.w, vh: +e.target.value || vp.h })} aria-label="高さ(px)" />
          {customSize && <button className="url-size-reset" title="デバイスの既定サイズに戻す" onClick={() => onSessionChange({ ...session, vw: null, vh: null })}>↺</button>}
        </span>
        <button className="cap" onClick={capture} disabled={loading || !!error}>＋ この画面を追加{count > 0 ? `（${count}）` : ''}</button>
        <button className="btn sm" onClick={onClose}>完了</button>
      </div>

      <div className="url-body">
        <div className={`sess-wrap${interactive ? ' live' : ''}`} tabIndex={0}
          onWheel={onWheel} onClick={() => imeRef.current?.focus()}>
          {loading ? <RenderingIndicator estimate={6} label="サイトを開いています" />
            : error ? <div className="stage-empty"><p style={{ color: 'var(--danger)' }}>{error}</p></div>
            : shot ? (
              <img ref={imgRef} className="sess-img" src={shot} alt="操作中の画面" draggable={false}
                style={{ aspectRatio: `${vp.w} / ${vp.h}` }} onClick={onImgClick} />
            ) : null}
          {/* IME・キー入力を受ける隠しinput（interactive時のみ） */}
          {interactive && (
            <input ref={imeRef} className="sess-ime" aria-hidden="true" tabIndex={-1}
              onKeyDown={onKeyDown} onBeforeInput={onBeforeInput} onPaste={onPaste}
              onCompositionStart={onCompositionStart} onCompositionEnd={onCompositionEnd} />
          )}
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
        {interactive === false
          ? 'この環境では「URLを開いて撮影」のみ利用できます（画面内のクリック・入力はできません）。クリックしながら操作したい場合はローカル版（npm run dev）をご利用ください。'
          : '画面の中をクリック・入力・スクロールできます。日本語入力（IME）や Cmd/Ctrl+A（全選択）・コピー＆ペーストも使えます。入力やボタンで見た目が変わった状態も「＋ この画面を追加」で撮影できます（URLが変わらなくてもOK）。'}
      </div>
    </>
  );
}
