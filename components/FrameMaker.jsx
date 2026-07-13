'use client';

import { useEffect, useRef, useState } from 'react';
import { setPreviewFrame, PREVIEW_FRAME_ID } from '@/lib/devices.js';
import { saveFrame } from '@/lib/customFrames.js';
import { DEFAULT_SETTINGS, COLOR_PRESETS } from '@/lib/defaults.js';
import ItemCanvas from './ItemCanvas.jsx';

// 出発点プリセット（下地）。ここから微調整＝キャラメイク的。group は機種一覧の分類。
const PRESETS = [
  { id: 'notch', label: 'ノッチ', group: 'phone', p: { w: 420, h: 900, ro: 52, ri: 40, bezSide: 14, bezTop: 16, bezBottom: 16, cutout: 'notch', buttons: true, camDot: false, home: false } },
  { id: 'punch', label: 'パンチ穴', group: 'phone', p: { w: 420, h: 912, ro: 54, ri: 42, bezSide: 12, bezTop: 12, bezBottom: 12, cutout: 'holecenter', buttons: true, camDot: false, home: false } },
  { id: 'full', label: 'ベゼルレス', group: 'phone', p: { w: 420, h: 910, ro: 56, ri: 46, bezSide: 8, bezTop: 8, bezBottom: 8, cutout: 'holecenter', buttons: true, camDot: false, home: false } },
  { id: 'home', label: 'ホームボタン', group: 'phone', p: { w: 400, h: 800, ro: 44, ri: 8, bezSide: 20, bezTop: 60, bezBottom: 84, cutout: 'none', buttons: true, camDot: true, home: true } },
  { id: 'mini', label: 'コンパクト', group: 'phone', p: { w: 360, h: 760, ro: 46, ri: 38, bezSide: 12, bezTop: 12, bezBottom: 12, cutout: 'holecenter', buttons: true, camDot: false, home: false } },
  { id: 'max', label: '大型', group: 'phone', p: { w: 460, h: 995, ro: 58, ri: 46, bezSide: 12, bezTop: 14, bezBottom: 14, cutout: 'notch', buttons: true, camDot: false, home: false } },
  { id: 'square', label: 'ガラケー風', group: 'phone', p: { w: 380, h: 560, ro: 30, ri: 6, bezSide: 26, bezTop: 40, bezBottom: 70, cutout: 'none', buttons: false, camDot: true, home: true } },
  { id: 'tablet', label: 'タブレット', group: 'tablet', p: { w: 760, h: 1050, ro: 36, ri: 18, bezSide: 26, bezTop: 26, bezBottom: 26, cutout: 'none', buttons: false, camDot: true, home: false } },
  { id: 'tablet-home', label: 'タブレット(ホーム)', group: 'tablet', p: { w: 760, h: 1060, ro: 30, ri: 10, bezSide: 40, bezTop: 70, bezBottom: 70, cutout: 'none', buttons: false, camDot: true, home: true } },
];

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
 * フレームメーカー：パラメータで端末フレームを自作（ベクター＝色替え可）。
 * 既存の drawSlab で描くので、保存後は色・傾き・背景をすべて適用できる。
 */
export default function FrameMaker({ onChanged, pushToast }) {
  const [name, setName] = useState('マイフレーム');
  const [group, setGroup] = useState('phone'); // 'phone' | 'tablet'（機種一覧の分類）
  const [presetId, setPresetId] = useState('notch');
  const [p, setP] = useState(PRESETS[0].p);
  const [color, setColor] = useState('#15171c');
  const [ver, setVer] = useState(0);
  const sample = useSample();

  const buildDef = (id) => ({
    id, label: name || 'マイフレーム',
    group: group === 'tablet' ? 'タブレット' : 'スマートフォン',
    canRotate: true,
    viewport: { w: Math.round(p.w * 3), h: Math.round(p.h * 3) },
    css: { w: Math.round(p.w), h: Math.round(p.h), mobile: true },
    kind: 'programmatic',
    spec: {
      base: { w: p.w, h: p.h }, bez: p.bezSide, bezSide: p.bezSide, bezTop: p.bezTop, bezBottom: p.bezBottom,
      ro: p.ro, ri: p.ri, cutout: p.cutout, buttons: p.buttons, camDot: p.camDot, home: p.home, draw: 'slab',
    },
  });

  useEffect(() => {
    setPreviewFrame(buildDef(PREVIEW_FRAME_ID));
    setVer((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, group]);
  useEffect(() => () => setPreviewFrame(null), []);

  const upd = (patch) => setP((pp) => ({ ...pp, ...patch }));
  const choosePreset = (pr) => { setPresetId(pr.id); setGroup(pr.group); setP(pr.p); };

  const previewSettings = { ...DEFAULT_SETTINGS, frameColor: color, fit: 'cover', shadow: true, shadowStr: 0.35, pad: 40 };
  const previewItem = sample ? { id: 'fm-prev', kind: 'image', img: sample, device: PREVIEW_FRAME_ID, orientation: 'portrait', name: 'preview' } : null;

  const save = async () => {
    const id = 'custom-' + (slug(name) || 'frame') + '-' + ver + '-' + Math.round(p.w) + p.h;
    await saveFrame(buildDef(id));
    onChanged?.();
    pushToast?.({ kind: 'ok', message: `フレーム「${name}」を保存しました（機種一覧から選べます）` });
  };

  return (
    <div className="fm">
      <div className="fm-preview">
        {previewItem && <ItemCanvas item={previewItem} settings={previewSettings} bgImg={null} rs={0.5} N={14} version={ver} />}
      </div>
      <div className="fm-controls">
        <div className="field"><label>名前</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>

        <div className="field" style={{ margin: 0 }}>
          <label>ベース（下地から選んで微調整）</label>
          <div className="fm-presets">
            {PRESETS.map((pr) => (
              <button key={pr.id} type="button" className={`fm-preset${presetId === pr.id ? ' on' : ''}`} onClick={() => choosePreset(pr)}>{pr.label}</button>
            ))}
          </div>
        </div>

        <div className="fm-sliders">
          <FMSlider label="幅" v={p.w} min={280} max={1000} onChange={(w) => upd({ w })} />
          <FMSlider label="高さ" v={p.h} min={480} max={1500} onChange={(h) => upd({ h })} />
          <FMSlider label="角丸（外）" v={p.ro} min={0} max={100} onChange={(ro) => upd({ ro })} />
          <FMSlider label="角丸（画面）" v={p.ri} min={0} max={90} onChange={(ri) => upd({ ri })} />
          <FMSlider label="ベゼル（左右）" v={p.bezSide} min={2} max={90} onChange={(bezSide) => upd({ bezSide })} />
          <FMSlider label="ベゼル（上）" v={p.bezTop} min={2} max={160} onChange={(bezTop) => upd({ bezTop })} />
          <FMSlider label="ベゼル（下）" v={p.bezBottom} min={2} max={160} onChange={(bezBottom) => upd({ bezBottom })} />
        </div>

        <div className="fm-row2">
          <div className="field" style={{ margin: 0 }}><label>上部カットアウト</label>
            <div className="seg full">
              {CUTOUTS.map(([v, l]) => <button key={v} className={p.cutout === v ? 'on' : ''} onClick={() => upd({ cutout: v })}>{l}</button>)}
            </div>
          </div>
          <div className="field" style={{ margin: 0 }}><label>分類</label>
            <div className="seg full">
              <button className={group === 'phone' ? 'on' : ''} onClick={() => setGroup('phone')}>スマホ</button>
              <button className={group === 'tablet' ? 'on' : ''} onClick={() => setGroup('tablet')}>タブレット</button>
            </div>
          </div>
        </div>

        <div className="fm-toggles">
          <label><input type="checkbox" checked={p.buttons} onChange={(e) => upd({ buttons: e.target.checked })} /> サイドボタン</label>
          <label><input type="checkbox" checked={p.camDot} onChange={(e) => upd({ camDot: e.target.checked })} /> カメラ点</label>
          <label><input type="checkbox" checked={p.home} onChange={(e) => upd({ home: e.target.checked })} /> ホームボタン</label>
        </div>

        <div className="field" style={{ margin: 0 }}><label>色（保存後も変更できます）</label>
          <div className="swatches">
            {COLOR_PRESETS.map((c) => (
              <button key={c.color} className={`sw${color === c.color ? ' on' : ''}`} style={{ background: c.color }} title={c.name} aria-label={c.name} onClick={() => setColor(c.color)} />
            ))}
            <input type="color" className="color" style={{ width: 24, height: 24 }} value={color} onChange={(e) => setColor(e.target.value)} aria-label="その他の色" />
          </div>
        </div>

        <button className="primary" style={{ width: '100%', marginTop: 4 }} onClick={save}>この端末を保存</button>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>保存すると機種一覧に追加され、色・傾き・背景も自由に変えられます。</p>
      </div>
    </div>
  );
}

function FMSlider({ label, v, min, max, onChange }) {
  const clamp = (n) => Math.max(min, Math.min(max, n));
  return (
    <div className="fm-slider">
      <label>{label}
        <input type="number" className="fm-num" min={min} max={max} value={Math.round(v)}
          onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(clamp(n)); }} />
      </label>
      <input type="range" min={min} max={max} value={v} onChange={(e) => onChange(clamp(Number(e.target.value)))} />
    </div>
  );
}
