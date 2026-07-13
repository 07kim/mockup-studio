'use client';

import { useEffect, useRef, useState } from 'react';
import { readRaw, saveFrame, deleteFrame, exportJson, importJson } from '@/lib/customFrames.js';
import { hexToRgb } from '@/lib/engine.js';
import FrameMaker from './FrameMaker.jsx';

const MAXW = 460; // プレビュー最大幅

/** カスタムフレーム作成UI（アセット型・§3.10）。 */
export default function FrameStudio({ onClose, onChanged, pushToast }) {
  const [baseImg, setBaseImg] = useState(null); // { img, dataUrl }
  const [overlayDataUrl, setOverlayDataUrl] = useState(null);
  const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0, radius: 24 });
  const [label, setLabel] = useState('マイフレーム');
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  const [chroma, setChroma] = useState({ on: false, color: '#ff0000', threshold: 100 });
  const [origBaseUrl, setOrigBaseUrl] = useState(null); // 抜く前の元写真（全部戻す用）
  const [removed, setRemoved] = useState([]); // 透明化した色の一覧（複数OK）
  const [mode, setMode] = useState('param'); // 'param'（パラメータで作る・色替え可）| 'photo'（写真から）
  const [list, setList] = useState([]);
  const canvasRef = useRef(null);
  const baseFileRef = useRef(null);
  const overlayFileRef = useRef(null);
  const importRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => { setList(readRaw()); }, []);

  const scale = baseImg ? Math.min(1, MAXW / baseImg.img.width) : 1;

  // キャンバス描画（base + rect）
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !baseImg) return;
    const dw = baseImg.img.width * scale;
    const dh = baseImg.img.height * scale;
    cv.width = dw; cv.height = dh;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, dw, dh);
    // 市松
    ctx.fillStyle = '#333'; ctx.fillRect(0, 0, dw, dh);
    ctx.drawImage(baseImg.img, 0, 0, dw, dh);
    // rect
    ctx.strokeStyle = '#5b8cff'; ctx.lineWidth = 2;
    ctx.strokeRect(rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
    ctx.fillStyle = 'rgba(91,140,255,.15)';
    ctx.fillRect(rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
  }, [baseImg, rect, scale]);

  const loadImageFile = (file, cb) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => cb(img, reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const onBaseFile = (file) => {
    if (!file) return;
    loadImageFile(file, (img, dataUrl) => {
      setBaseImg({ img, dataUrl });
      setOrigBaseUrl(dataUrl); // 抜く前の状態を保持
      setRemoved([]);
      // 既定 rect: 中央 60%
      setRect({ x: Math.round(img.width * 0.2), y: Math.round(img.height * 0.2), w: Math.round(img.width * 0.6), h: Math.round(img.height * 0.6), radius: 24 });
      setVp({ w: Math.round(img.width * 0.6), h: Math.round(img.height * 0.6) });
    });
  };

  const onOverlayFile = (file) => {
    if (!file) return;
    loadImageFile(file, (_img, dataUrl) => setOverlayDataUrl(dataUrl));
  };

  // rect ドラッグ描画
  const canvasPos = (e) => {
    const cv = canvasRef.current;
    if (!cv) return null; // 再描画などで一時的に外れている時は無視
    const r = cv.getBoundingClientRect();
    // 表示サイズが CSS で縮小されても正しく画像座標へ変換（内部px/表示px ÷ scale）。
    const sx = r.width ? cv.width / r.width : 1;
    const sy = r.height ? cv.height / r.height : 1;
    return { x: ((e.clientX - r.left) * sx) / scale, y: ((e.clientY - r.top) * sy) / scale };
  };
  const onDown = (e) => { const p = canvasPos(e); if (p) drag.current = p; };
  const onMove = (e) => {
    if (!drag.current) return;
    const p = canvasPos(e);
    if (!p) return;
    const x = Math.min(drag.current.x, p.x), y = Math.min(drag.current.y, p.y);
    setRect((r) => ({ ...r, x: Math.round(x), y: Math.round(y), w: Math.round(Math.abs(p.x - drag.current.x)), h: Math.round(Math.abs(p.y - drag.current.y)) }));
  };
  const onUp = () => { drag.current = null; };

  // 画面矩形：中央揃え・リセット（イラレ風の整列）
  const imgW = baseImg ? baseImg.img.width : 0;
  const imgH = baseImg ? baseImg.img.height : 0;
  const centerX = () => setRect((r) => ({ ...r, x: Math.round((imgW - r.w) / 2) }));
  const centerY = () => setRect((r) => ({ ...r, y: Math.round((imgH - r.h) / 2) }));
  const centerBoth = () => setRect((r) => ({ ...r, x: Math.round((imgW - r.w) / 2), y: Math.round((imgH - r.h) / 2) }));
  const resetRect = () => setRect({ x: Math.round(imgW * 0.2), y: Math.round(imgH * 0.2), w: Math.round(imgW * 0.6), h: Math.round(imgH * 0.6), radius: 24 });

  // クロマキー（画面/背景のベタ塗り色を透明化）。現在の写真に重ねて適用＝複数色OK。
  const applyChroma = () => {
    if (!baseImg) return;
    const { img } = baseImg;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0); // 既に透明化済みの画素は透明のまま保持される
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const { r, g, b } = hexToRgb(chroma.color);
    const th = chroma.threshold;
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue; // 既に透明ならスキップ
      const dist = Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b);
      if (dist < th) d[i + 3] = 0;
    }
    ctx.putImageData(data, 0, 0);
    const dataUrl = c.toDataURL('image/png');
    const out = new Image();
    out.onload = () => setBaseImg({ img: out, dataUrl });
    out.src = dataUrl;
    setRemoved((l) => [...l, chroma.color]);
    pushToast?.({ kind: 'ok', message: `色を透明化しました（計${removed.length + 1}色）` });
  };

  // 抜く前の写真に戻す（クロマキーをすべて取り消し）
  const restorePhoto = () => {
    if (!origBaseUrl) return;
    const im = new Image();
    im.onload = () => setBaseImg({ img: im, dataUrl: origBaseUrl });
    im.src = origBaseUrl;
    setRemoved([]);
    pushToast?.({ kind: 'ok', message: '元の写真に戻しました' });
  };

  // スポイト（対応ブラウザのみ）：写真上の実際の色を拾う
  const pickColor = async () => {
    try { const res = await new window.EyeDropper().open(); setChroma((cc) => ({ ...cc, color: res.sRGBHex })); }
    catch { /* キャンセル時は無視 */ }
  };

  const save = async () => {
    if (!baseImg) { pushToast?.({ kind: 'err', message: 'base 画像を選択してください' }); return; }
    if (rect.w < 4 || rect.h < 4) { pushToast?.({ kind: 'err', message: '画面矩形を指定してください' }); return; }
    const id = 'custom-' + label.replace(/\s+/g, '-').toLowerCase() + '-' + readRaw().length;
    const def = {
      id, label, group: 'カスタム', canRotate: false,
      viewport: { w: vp.w, h: vp.h }, kind: 'asset',
      asset: {
        baseImage: baseImg.dataUrl,
        overlayImage: overlayDataUrl || undefined,
        imageSize: { w: baseImg.img.width, h: baseImg.img.height },
        screen: { x: rect.x, y: rect.y, w: rect.w, h: rect.h, radius: rect.radius },
        screenBackedTransparent: true,
      },
    };
    await saveFrame(def);
    setList(readRaw());
    onChanged?.();
    pushToast?.({ kind: 'ok', message: `フレーム「${label}」を保存しました` });
  };

  const remove = async (id) => {
    await deleteFrame(id);
    setList(readRaw());
    onChanged?.();
  };

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'custom-frames.json';
    a.click();
  };

  const doImport = async (file) => {
    if (!file) return;
    const text = await file.text();
    try { await importJson(text); setList(readRaw()); onChanged?.(); pushToast?.({ kind: 'ok', message: 'フレームをインポートしました' }); }
    catch (e) { pushToast?.({ kind: 'err', message: `インポート失敗: ${e.message}` }); }
  };

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="カスタムフレーム作成">
      <div className="panel-box" style={{ maxWidth: 880, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>フレームを自作</h3>

        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => doImport(e.target.files?.[0])} />

        <div className="seg full" style={{ marginBottom: 14 }}>
          <button className={mode === 'param' ? 'on' : ''} onClick={() => setMode('param')}>パラメータで作る（色替え可）</button>
          <button className={mode === 'photo' ? 'on' : ''} onClick={() => setMode('photo')}>写真から作る</button>
        </div>

        {mode === 'param' && (
          <FrameMaker onChanged={() => { onChanged?.(); setList(readRaw()); }} pushToast={pushToast} />
        )}

        {mode === 'photo' && (<>
        <input ref={baseFileRef} type="file" accept="image/png,image/webp" style={{ display: 'none' }} onChange={(e) => onBaseFile(e.target.files?.[0])} />
        <input ref={overlayFileRef} type="file" accept="image/png,image/webp" style={{ display: 'none' }} onChange={(e) => onOverlayFile(e.target.files?.[0])} />

        <p className="muted" style={{ marginTop: 0 }}>
          お手持ちの<b>端末の写真</b>（枠だけ・画面部分が空き、または1色でベタ塗りのPNG）から、好きな機種を追加できます。
        </p>

        {!baseImg ? (
          <button className="primary" style={{ width: '100%' }} onClick={() => baseFileRef.current?.click()}>
            ① 端末の写真を選ぶ
          </button>
        ) : (
          <div className="fm fm-photo">
            <div className="fm-preview">
              <canvas
                ref={canvasRef}
                style={{ cursor: 'crosshair', maxWidth: '100%', maxHeight: 440, borderRadius: 6 }}
                onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
              />
            </div>
            <div className="fm-controls">
              <p className="step-head" style={{ marginTop: 0 }}>② 画面が入る場所を囲む</p>
              <p className="muted" style={{ marginTop: 0 }}>左の写真で四角をドラッグ。スライダーでも微調整でき、中央揃え・リセットも使えます。</p>
              <div className="fm-sliders">
                <RSlider label="左" v={rect.x} min={0} max={imgW} onChange={(x) => setRect((r) => ({ ...r, x }))} />
                <RSlider label="上" v={rect.y} min={0} max={imgH} onChange={(y) => setRect((r) => ({ ...r, y }))} />
                <RSlider label="幅" v={rect.w} min={10} max={imgW} onChange={(w) => setRect((r) => ({ ...r, w }))} />
                <RSlider label="高さ" v={rect.h} min={10} max={imgH} onChange={(h) => setRect((r) => ({ ...r, h }))} />
                <RSlider label="角丸" v={rect.radius} min={0} max={Math.round(Math.min(rect.w, rect.h) / 2)} onChange={(radius) => setRect((r) => ({ ...r, radius }))} />
              </div>
              <div className="fm-align">
                <button className="btn sm" onClick={centerX} title="左右の中央に">↔ 横中央</button>
                <button className="btn sm" onClick={centerY} title="上下の中央に">↕ 縦中央</button>
                <button className="btn sm" onClick={centerBoth}>＋ 中央に</button>
                <button className="btn sm" onClick={resetRect}>⟲ リセット</button>
                <button className="btn sm" onClick={() => baseFileRef.current?.click()}>写真を選び直す</button>
              </div>

              <p className="step-head">③ 画面や背景の色を抜く（任意・複数OK）</p>
              <p className="muted" style={{ marginTop: 0 }}>ベタ塗りの画面色や背景色を、何色でも透明化できます。色を選んで「この色を抜く」を押すと重ねて抜けます。</p>
              {removed.length > 0 && (
                <div className="chroma-chips">
                  {removed.map((c, i) => <span key={i} className="chroma-chip"><i style={{ background: c }} />{c}</span>)}
                  <button className="btn sm" onClick={restorePhoto}>⟲ 全部戻す</button>
                </div>
              )}
              <div className="row tight" style={{ marginTop: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="field" style={{ margin: 0 }}><label>抜く色</label>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <input type="color" value={chroma.color} onChange={(e) => setChroma({ ...chroma, color: e.target.value })} />
                    {typeof window !== 'undefined' && window.EyeDropper && <button className="btn sm" onClick={pickColor} title="写真から色を拾う">💧 スポイト</button>}
                  </span>
                </div>
                <div className="field" style={{ margin: 0, width: 96 }}><label>許容範囲</label><input type="number" value={chroma.threshold} onChange={(e) => setChroma({ ...chroma, threshold: +e.target.value })} /></div>
                <button className="primary" onClick={applyChroma}>この色を抜く</button>
              </div>

              <p className="step-head">④ 仕上げ</p>
              <div className="fm-row2">
                <div className="field" style={{ margin: 0 }}><label>名前（機種一覧に表示）</label><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
                <div className="field" style={{ margin: 0 }}><label>ノッチ等を重ねる（任意）</label>
                  <button className="btn sm" style={{ width: '100%' }} onClick={() => overlayFileRef.current?.click()}>{overlayDataUrl ? '重ねる画像を変更' : '画像を選ぶ'}</button>
                </div>
              </div>
              <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={save}>このフレームを保存</button>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>機種一覧に追加されます。※写真ベースのため色替えは不可（色を変えたい時は「パラメータで作る」）。</p>
            </div>
          </div>
        )}
        </>)}

        <h3 className="section" style={{ marginTop: 16 }}>保存済みフレーム</h3>
        {list.length === 0 && <p className="muted">まだありません。</p>}
        {list.map((f) => (
          <div className="row" key={f.id} style={{ marginBottom: 4 }}>
            <span style={{ flex: 1 }}>{f.label} <span className="muted">({f.kind === 'programmatic' ? 'パラメータ' : `${f.asset.imageSize.w}×${f.asset.imageSize.h}`})</span></span>
            <button className="danger" style={{ flex: '0 0 auto' }} onClick={() => remove(f.id)}>削除</button>
          </div>
        ))}

        <div className="row tight" style={{ marginTop: 12 }}>
          <button onClick={doExport}>エクスポート(JSON)</button>
          <button onClick={() => importRef.current?.click()}>インポート(JSON)</button>
          <button onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

/** 数値入力＋シークバー（イラレ風に直感操作）。 */
function RSlider({ label, v, min, max, onChange }) {
  const clamp = (n) => Math.max(min, Math.min(max, n));
  return (
    <div className="fm-slider">
      <label>{label}
        <input type="number" className="fm-num" value={Math.round(v)}
          onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(clamp(n)); }} />
      </label>
      <input type="range" min={min} max={Math.max(min, max)} value={clamp(v)} onChange={(e) => onChange(clamp(Number(e.target.value)))} />
    </div>
  );
}
