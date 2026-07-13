'use client';

import { useEffect, useRef, useState } from 'react';
import { setPreviewFrame, PREVIEW_FRAME_ID } from '@/lib/devices.js';
import { saveFrame } from '@/lib/customFrames.js';
import { DEFAULT_SETTINGS, COLOR_PRESETS } from '@/lib/defaults.js';
import ItemCanvas from './ItemCanvas.jsx';

// 出発点プリセット（デザイン単位）。ここから微調整する＝キャラメイク的。
const PHONE = { w: 420, h: 900, ro: 52, ri: 40, bezSide: 14, bezTop: 14, bezBottom: 14, cutout: 'notch', buttons: true, camDot: false, home: false };
const TABLET = { w: 760, h: 1050, ro: 36, ri: 18, bezSide: 26, bezTop: 26, bezBottom: 26, cutout: 'none', buttons: false, camDot: true, home: false };

const CUTOUTS = [['none', 'なし'], ['notch', 'ノッチ'], ['holecenter', 'パンチ穴']];

/** サンプル画面（プレビュー用のダミー・スクショ）。 */
function useSample() {
  const [img, setImg] = useState(null);
  useEffect(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 850;
    const x = c.getContext('2d');
    x.fillStyle = '#f4f7fb'; x.fillRect(0, 0, 400, 850);
    x.fillStyle = '#3b6ea5'; x.fillRect(0, 0, 400, 150);
    x.fillStyle = '#fff'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.fillText('Preview', 200, 95);
    x.fillStyle = '#dbe4ee'; for (let i = 0; i < 4; i++) x.fillRect(34, 205 + i * 68, 332, 44);
    x.fillStyle = '#3b6ea5'; x.fillRect(34, 560, 332, 52);
    x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText('はじめる', 200, 593);
    const im = new Image(); im.onload = () => setImg(im); im.src = c.toDataURL('image/png');
  }, []);
  return img;
}

const slug = (s) => (s || 'frame').trim().replace(/\s+/g, '-').toLowerCase().replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, '');

/**
 * フレームメーカー：パラメータで端末フレームを自作する（ベクター＝色替え可）。
 * 既存のプログラム型描画エンジン（drawSlab）を使うので、保存後は普通の機種と同様に
 * 色・傾き・背景などをすべて適用できる。
 */
export default function FrameMaker({ onChanged, pushToast }) {
  const [name, setName] = useState('マイフレーム');
  const [type, setType] = useState('phone');
  const [p, setP] = useState(PHONE);
  const [color, setColor] = useState('#15171c');
  const [ver, setVer] = useState(0);
  const sample = useSample();
  const savedRef = useRef(false);

  const buildDef = (id) => ({
    id, label: name || 'マイフレーム',
    group: type === 'tablet' ? 'タブレット' : 'スマートフォン',
    canRotate: true,
    viewport: { w: Math.round(p.w * 3), h: Math.round(p.h * 3) },
    css: { w: Math.round(p.w), h: Math.round(p.h), mobile: true },
    kind: 'programmatic',
    spec: {
      base: { w: p.w, h: p.h }, bez: p.bezSide, bezSide: p.bezSide, bezTop: p.bezTop, bezBottom: p.bezBottom,
      ro: p.ro, ri: p.ri, cutout: p.cutout, buttons: p.buttons, camDot: p.camDot, home: p.home, draw: 'slab',
    },
  });

  // パラメータ変更のたびにプレビュー用フレームを差し替え→再描画。
  useEffect(() => {
    setPreviewFrame(buildDef(PREVIEW_FRAME_ID));
    setVer((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, type]);
  // 閉じる時にプレビューを解除。
  useEffect(() => () => setPreviewFrame(null), []);

  const upd = (patch) => setP((pp) => ({ ...pp, ...patch }));
  const chooseType = (t) => { setType(t); setP(t === 'tablet' ? TABLET : PHONE); };

  const previewSettings = { ...DEFAULT_SETTINGS, frameColor: color, fit: 'cover', shadow: true, shadowStr: 0.35, pad: 40 };
  const previewItem = sample ? { id: 'fm-prev', kind: 'image', img: sample, device: PREVIEW_FRAME_ID, orientation: 'portrait', name: 'preview' } : null;

  const save = async () => {
    const id = 'custom-' + (slug(name) || 'frame') + '-' + ver + '-' + Math.round(p.w) + p.h;
    await saveFrame(buildDef(id));
    savedRef.current = true;
    onChanged?.();
    pushToast?.({ kind: 'ok', message: `フレーム「${name}」を保存しました（機種一覧から選べます）` });
  };

  return (
    <div className="fm">
      <div className="fm-preview">
        {previewItem && <ItemCanvas item={previewItem} settings={previewSettings} bgImg={null} rs={0.42} N={12} version={ver} />}
      </div>
      <div className="fm-controls">
        <div className="field"><label>名前</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>

        <div className="field"><label>種類</label>
          <div className="seg full">
            <button className={type === 'phone' ? 'on' : ''} onClick={() => chooseType('phone')}>スマホ</button>
            <button className={type === 'tablet' ? 'on' : ''} onClick={() => chooseType('tablet')}>タブレット</button>
          </div>
        </div>

        <FMSlider label="幅" v={p.w} min={280} max={900} onChange={(w) => upd({ w })} />
        <FMSlider label="高さ" v={p.h} min={500} max={1400} onChange={(h) => upd({ h })} />
        <FMSlider label="角丸（外）" v={p.ro} min={0} max={90} onChange={(ro) => upd({ ro })} />
        <FMSlider label="角丸（画面）" v={p.ri} min={0} max={80} onChange={(ri) => upd({ ri })} />
        <FMSlider label="ベゼル（左右）" v={p.bezSide} min={4} max={80} onChange={(bezSide) => upd({ bezSide })} />
        <FMSlider label="ベゼル（上）" v={p.bezTop} min={4} max={140} onChange={(bezTop) => upd({ bezTop })} />
        <FMSlider label="ベゼル（下）" v={p.bezBottom} min={4} max={140} onChange={(bezBottom) => upd({ bezBottom })} />

        <div className="field"><label>上部カットアウト</label>
          <div className="seg full">
            {CUTOUTS.map(([v, l]) => <button key={v} className={p.cutout === v ? 'on' : ''} onClick={() => upd({ cutout: v })}>{l}</button>)}
          </div>
        </div>

        <div className="fm-toggles">
          <label><input type="checkbox" checked={p.buttons} onChange={(e) => upd({ buttons: e.target.checked })} /> サイドボタン</label>
          <label><input type="checkbox" checked={p.camDot} onChange={(e) => upd({ camDot: e.target.checked })} /> カメラ点</label>
          <label><input type="checkbox" checked={p.home} onChange={(e) => upd({ home: e.target.checked })} /> ホームボタン</label>
        </div>

        <div className="field"><label>色（保存後も変更できます）</label>
          <div className="swatches">
            {COLOR_PRESETS.map((c) => (
              <button key={c.color} className={`sw${color === c.color ? ' on' : ''}`} style={{ background: c.color }} title={c.name} aria-label={c.name} onClick={() => setColor(c.color)} />
            ))}
            <input type="color" className="color" style={{ width: 24, height: 24 }} value={color} onChange={(e) => setColor(e.target.value)} aria-label="その他の色" />
          </div>
        </div>

        <button className="primary" style={{ width: '100%', marginTop: 10 }} onClick={save}>この端末を保存</button>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>保存すると機種一覧に追加され、色・傾き・背景も自由に変えられます。</p>
      </div>
    </div>
  );
}

function FMSlider({ label, v, min, max, onChange }) {
  return (
    <div className="fm-slider">
      <label>{label} <span className="val">{Math.round(v)}</span></label>
      <input type="range" min={min} max={max} value={v} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
