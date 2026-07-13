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
      // 既定 rect: 中央 60%
      setRect({ x: img.width * 0.2, y: img.height * 0.2, w: img.width * 0.6, h: img.height * 0.6, radius: 24 });
      setVp({ w: Math.round(img.width * 0.6), h: Math.round(img.height * 0.6) });
    });
  };

  const onOverlayFile = (file) => {
    if (!file) return;
    loadImageFile(file, (_img, dataUrl) => setOverlayDataUrl(dataUrl));
  };

  // rect ドラッグ描画
  const canvasPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };
  const onDown = (e) => { drag.current = canvasPos(e); };
  const onMove = (e) => {
    if (!drag.current) return;
    const p = canvasPos(e);
    const x = Math.min(drag.current.x, p.x), y = Math.min(drag.current.y, p.y);
    setRect((r) => ({ ...r, x: Math.round(x), y: Math.round(y), w: Math.round(Math.abs(p.x - drag.current.x)), h: Math.round(Math.abs(p.y - drag.current.y)) }));
  };
  const onUp = () => { drag.current = null; };

  // クロマキー（画面プレースホルダ色を透明化）
  const applyChroma = () => {
    if (!baseImg) return;
    const { img } = baseImg;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const { r, g, b } = hexToRgb(chroma.color);
    const th = chroma.threshold;
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const dist = Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b);
      if (dist < th) d[i + 3] = 0;
    }
    ctx.putImageData(data, 0, 0);
    const dataUrl = c.toDataURL('image/png');
    const out = new Image();
    out.onload = () => setBaseImg({ img: out, dataUrl });
    out.src = dataUrl;
    pushToast?.({ kind: 'ok', message: '画面色を透明化しました' });
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
      <div className="panel-box" style={{ maxWidth: mode === 'param' ? 880 : 560, width: '100%' }} onClick={(e) => e.stopPropagation()}>
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

        <div className="row tight" style={{ marginBottom: 8 }}>
          <button onClick={() => baseFileRef.current?.click()}>base 画像を選択</button>
          <button onClick={() => overlayFileRef.current?.click()} disabled={!baseImg}>overlay（任意）</button>
        </div>

        {baseImg && (
          <>
            <p className="muted">画面領域をドラッグで指定（青枠）。base は画面を透明に抜いた PNG 推奨。</p>
            <canvas
              ref={canvasRef}
              style={{ border: '1px solid var(--border)', cursor: 'crosshair', maxWidth: '100%' }}
              onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            />
            <div className="row tight" style={{ marginTop: 8 }}>
              <div className="field" style={{ margin: 0 }}><label>X</label><input type="number" value={rect.x} onChange={(e) => setRect({ ...rect, x: +e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Y</label><input type="number" value={rect.y} onChange={(e) => setRect({ ...rect, y: +e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>W</label><input type="number" value={rect.w} onChange={(e) => setRect({ ...rect, w: +e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>H</label><input type="number" value={rect.h} onChange={(e) => setRect({ ...rect, h: +e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>角丸</label><input type="number" value={rect.radius} onChange={(e) => setRect({ ...rect, radius: +e.target.value })} /></div>
            </div>

            <label className="row" style={{ margin: '8px 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={chroma.on} onChange={(e) => setChroma({ ...chroma, on: e.target.checked })} style={{ flex: '0 0 auto', width: 16, height: 16 }} />
              <span style={{ flex: 1 }}>画面プレースホルダ色を透明化</span>
            </label>
            {chroma.on && (
              <div className="row tight">
                <input type="color" value={chroma.color} onChange={(e) => setChroma({ ...chroma, color: e.target.value })} />
                <div className="field" style={{ margin: 0 }}><label>しきい値</label><input type="number" value={chroma.threshold} onChange={(e) => setChroma({ ...chroma, threshold: +e.target.value })} /></div>
                <button onClick={applyChroma}>適用</button>
              </div>
            )}

            <div className="row tight" style={{ marginTop: 8 }}>
              <div className="field" style={{ margin: 0 }}><label>ラベル</label><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
            </div>
            <div className="row tight">
              <div className="field" style={{ margin: 0 }}><label>viewport 幅</label><input type="number" value={vp.w} onChange={(e) => setVp({ ...vp, w: +e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>viewport 高</label><input type="number" value={vp.h} onChange={(e) => setVp({ ...vp, h: +e.target.value })} /></div>
            </div>
            <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={save}>フレームを保存</button>
          </>
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
