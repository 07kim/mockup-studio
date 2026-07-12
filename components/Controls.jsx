'use client';

import { useRef, useState } from 'react';
import { COLOR_PRESETS } from '@/lib/defaults.js';
import { getFrame } from '@/lib/devices.js';

// 写真の入れ方（アイコン付き）。frame は写実PNG枠では非表示。
const FI = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' };
const FITS = [
  {
    v: 'cover', name: 'ぴったり', hint: '画面いっぱいに写真を敷きます（はみ出た端は切れます）',
    icon: (<svg viewBox="0 0 44 34" {...FI}><rect x="9" y="-1" width="26" height="36" rx="2" fill="var(--accent)" stroke="none" opacity=".9" /><rect x="7" y="3" width="30" height="28" rx="4" /></svg>),
  },
  {
    v: 'contain', name: '全体を表示', hint: '写真を切らずに全部見せます（上下または左右に余白ができます）',
    icon: (<svg viewBox="0 0 44 34" {...FI}><rect x="10" y="10" width="24" height="14" rx="1.5" fill="var(--accent)" stroke="none" opacity=".9" /><rect x="7" y="3" width="30" height="28" rx="4" /></svg>),
  },
  {
    v: 'stretch', name: '引き伸ばす', hint: '画面の形に合わせて写真を変形させます（縦横比が変わります）',
    icon: (<svg viewBox="0 0 44 34" {...FI}><rect x="9" y="5" width="26" height="24" rx="1.5" fill="var(--accent)" stroke="none" opacity=".9" /><rect x="7" y="3" width="30" height="28" rx="4" /><path d="M2 17h4M38 17h4M4 15l-2 2 2 2M40 15l2 2-2 2" strokeWidth="1.3" /></svg>),
  },
  {
    v: 'frame', name: '写真の形に', hint: 'フレームの方を写真の縦横比に合わせて変形します', assetHide: true,
    icon: (<svg viewBox="0 0 44 34" {...FI}><rect x="13" y="6" width="18" height="22" rx="3" strokeDasharray="3 2" /><rect x="16" y="9" width="12" height="16" rx="1.5" fill="var(--accent)" stroke="none" opacity=".9" /></svg>),
  },
];

/** 右パネル＝デザイン調整のインスペクター（書き出し設定は書き出しダイアログへ分離）。 */
export default function Controls(props) {
  const {
    settings, onChange, onApplyAll, onApplySelected, selCount, totalCount,
    focusedItem, onUpdateRenderOpts, onRerender, onOpenExport, onSaveProject, onLoadProject, busy,
  } = props;
  const isHtml = focusedItem && focusedItem.kind === 'html';
  const frame = focusedItem ? getFrame(focusedItem.device) : null;
  const frameIsAsset = frame?.kind === 'asset'; // 写実PNG枠は「フレームの色」が効かない
  const ro = focusedItem?.renderOpts || {};
  const projRef = useRef(null);
  const [collapsed, setCollapsed] = useState({});
  const toggle = (k) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));
  const set = (patch) => onChange(patch);

  const fitOpts = FITS.filter((f) => !(f.assetHide && frameIsAsset));
  const fitCur = FITS.find((f) => f.v === settings.fit) || FITS[0];
  const fitLabel = fitCur.name;
  const tiltSum = (settings.rotX || settings.rotY) ? `左右${settings.rotY || 0}°` : 'なし';
  const colorName = COLOR_PRESETS.find((p) => p.color === settings.frameColor)?.name || 'カスタム';

  return (
    <>
      <div className="right-scroll">
        {totalCount === 0 ? (
          <div className="panel-hint" style={{ padding: '24px 16px', lineHeight: 1.7 }}>
            まず素材を追加しましょう。<br />
            左の「画像を追加」やドラッグ＆ドロップ、URL・フォルダから取り込むと、ここでデザインを調整できます。
          </div>
        ) : (
        <>
          {/* 編集対象 */}
          <div className="section scope-sec">
            <p className="label" style={{ marginBottom: totalCount > 1 ? 4 : 0 }}>
              {selCount > 1 ? `${selCount}件を調整中` : `「${focusedItem?.name || '素材'}」を調整中`}
            </p>
            {totalCount > 1 && (
              <>
                <div className="scope-help" style={{ marginBottom: 8 }}>
                  {selCount > 1 ? `変更・フレームの切替は選択中の${selCount}件にまとめて反映されます` : '変更はこの素材だけに反映されます（左でチェックすると複数まとめて変更）'}
                </div>
                <div className="row tight">
                  <button className="btn sm" style={{ flex: 1 }} disabled={!focusedItem} onClick={onApplyAll}>全てに同じ設定</button>
                  {selCount > 1 && <button className="btn sm" style={{ flex: 1 }} onClick={onApplySelected}>選択に同じ設定 ({selCount})</button>}
                </div>
              </>
            )}
          </div>

          {/* 機種・向き・ノッチは中央プレビュー上のツールバーで操作（右メニューには置かない） */}

          {/* フレームの色（写実PNG枠では効かないので隠す） */}
          {!frameIsAsset && (
          <Section id="color" title="フレームの色" sum={colorName} collapsed={collapsed} toggle={toggle}>
            <div className="swatches">
              {COLOR_PRESETS.map((p) => (
                <button key={p.color} className={`sw${settings.frameColor === p.color ? ' on' : ''}`} style={{ background: p.color }} title={p.name} aria-label={p.name} onClick={() => set({ frameColor: p.color })} />
              ))}
              <input type="color" className="color" style={{ width: 24, height: 24 }} value={settings.frameColor} onChange={(e) => set({ frameColor: e.target.value })} aria-label="その他の色" title="その他の色" />
            </div>
          </Section>
          )}

          {/* 写真の入れ方（画面への収め方）— アイコンで直感的に */}
          <Section id="fit" title="写真の入れ方" sum={fitLabel} collapsed={collapsed} toggle={toggle}>
            <div className="fit-grid">
              {fitOpts.map((o) => (
                <button key={o.v} type="button" className={`fit-opt${settings.fit === o.v ? ' on' : ''}`}
                  onClick={() => set({ fit: o.v })} title={o.hint}>
                  <span className="fit-ic">{o.icon}</span>
                  <span className="fit-name">{o.name}</span>
                </button>
              ))}
            </div>
            <div className="fit-hint">{fitCur.hint}</div>
            {settings.fit === 'contain' && (
              <div className="row" style={{ marginTop: 8 }}><span className="val">余白の色</span><input type="color" className="color" value={settings.screenBg} onChange={(e) => set({ screenBg: e.target.value })} /></div>
            )}
          </Section>

          {/* 背景は中央プレビュー左下の「背景」ボタンで設定する（右パネルからは分離） */}

          {/* 立体・傾き */}
          <Section id="tilt" title="立体・傾き" sum={tiltSum} collapsed={collapsed} toggle={toggle}>
            <div className="scope-help" style={{ marginBottom: 8 }}>中央プレビューの「傾き」ボタンでドラッグでも回せます</div>
            <div className="seg full">
              <button className={!settings.rotX && !settings.rotY ? 'on' : ''} onClick={() => set({ rotX: 0, rotY: 0, thickness: 0 })}>平面</button>
              <button className={settings.rotY < 0 ? 'on' : ''} onClick={() => set({ rotY: -18, rotX: 6, thickness: 26 })}>左向き</button>
              <button className={settings.rotY > 0 ? 'on' : ''} onClick={() => set({ rotY: 18, rotX: 6, thickness: 26 })}>右向き</button>
              <button className={settings.rotX >= 10 && settings.rotY < 0 ? 'on' : ''} onClick={() => set({ rotY: -20, rotX: 14, thickness: 24, perspTick: 28 })}>アイソメ</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <Slider label="左右の回転" val={`${settings.rotY}°`} min={-45} max={45} value={settings.rotY} onChange={(v) => set({ rotY: v })} />
              <Slider label="上下の回転" val={`${settings.rotX}°`} min={-45} max={45} value={settings.rotX} onChange={(v) => set({ rotX: v })} />
              <Slider label="厚み" val={settings.thickness} min={0} max={60} value={settings.thickness} onChange={(v) => set({ thickness: v })} />
              <Slider label="遠近感" val={settings.perspTick} min={0} max={100} value={settings.perspTick} onChange={(v) => set({ perspTick: v })} />
            </div>
          </Section>

          {/* サイズ・位置 */}
          <Section id="size" title="サイズ・位置" sum={`${Math.round((settings.deviceScale ?? 1) * 100)}%`} collapsed={collapsed} toggle={toggle}>
            <Slider label="大きさ" val={`${Math.round((settings.deviceScale ?? 1) * 100)}%`} min={0.3} max={2} step={0.05} value={settings.deviceScale ?? 1} onChange={(v) => set({ deviceScale: v })} />
            <Slider label="左右の位置" val={`${settings.offsetX ?? 0}%`} min={-50} max={50} value={settings.offsetX ?? 0} onChange={(v) => set({ offsetX: v })} />
            <Slider label="上下の位置" val={`${settings.offsetY ?? 0}%`} min={-50} max={50} value={settings.offsetY ?? 0} onChange={(v) => set({ offsetY: v })} />
            <button className="btn sm" style={{ width: '100%' }} onClick={() => set({ deviceScale: 1, offsetX: 0, offsetY: 0 })}>位置をリセット</button>
          </Section>

          {/* 影・余白 */}
          <Section id="finish" title="影・余白" sum={`${settings.shadow ? '影あり' : '影なし'}・${settings.pad === 0 ? '余白なし' : '余白' + settings.pad}`} collapsed={collapsed} toggle={toggle}>
            <div className="field"><label>影</label>
              <div className="seg full">
                <button className={!settings.shadow ? 'on' : ''} onClick={() => set({ shadow: false })}>なし</button>
                <button className={settings.shadow && settings.shadowStr <= 0.4 ? 'on' : ''} onClick={() => set({ shadow: true, shadowStr: 0.3 })}>弱</button>
                <button className={settings.shadow && settings.shadowStr > 0.4 && settings.shadowStr <= 0.7 ? 'on' : ''} onClick={() => set({ shadow: true, shadowStr: 0.55 })}>中</button>
                <button className={settings.shadow && settings.shadowStr > 0.7 ? 'on' : ''} onClick={() => set({ shadow: true, shadowStr: 0.85 })}>強</button>
              </div>
            </div>
            <div className="field"><label>まわりの余白</label>
              <div className="seg full">
                <button className={settings.pad === 0 ? 'on' : ''} onClick={() => set({ pad: 0 })}>なし</button>
                <button className={settings.pad > 0 && settings.pad <= 60 ? 'on' : ''} onClick={() => set({ pad: 40 })}>標準</button>
                <button className={settings.pad > 60 ? 'on' : ''} onClick={() => set({ pad: 120 })}>広め</button>
              </div>
            </div>
          </Section>

          {/* 撮影オプション（URL/フォルダ） */}
          {isHtml && (
            <Section id="capture" title="撮影オプション" sum={focusedItem.source?.type === 'url' ? 'URL' : 'フォルダ'} collapsed={collapsed} toggle={toggle}>
              <div className="field"><label>テーマ</label>
                <div className="seg full">
                  <button className={(ro.emulate || 'light') === 'light' ? 'on' : ''} onClick={() => onUpdateRenderOpts({ emulate: 'light' })}>ライト</button>
                  <button className={ro.emulate === 'dark' ? 'on' : ''} onClick={() => onUpdateRenderOpts({ emulate: 'dark' })}>ダーク</button>
                </div>
              </div>
              <div className="field"><label>読み込み待ち(ms)</label><input type="number" min={0} max={10000} value={ro.waitMs ?? 0} onChange={(e) => onUpdateRenderOpts({ waitMs: Number(e.target.value) })} /></div>
              <button className="btn sm" style={{ width: '100%' }} onClick={onRerender} disabled={focusedItem.loading}>再読み込み</button>
            </Section>
          )}
        </>
        )}
      </div>

      {/* フッター */}
      <div className="right-foot">
        <button className="btn primary" style={{ width: '100%' }} disabled={totalCount === 0} onClick={onOpenExport}>書き出す…</button>
        <div className="row" style={{ marginTop: 8 }}>
          <input ref={projRef} type="file" accept=".mockupproj,.zip" style={{ display: 'none' }} onChange={(e) => { onLoadProject(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="btn sm" style={{ flex: 1 }} disabled={totalCount === 0} onClick={onSaveProject}>保存</button>
          <button className="btn sm" style={{ flex: 1 }} onClick={() => projRef.current?.click()}>読込</button>
        </div>
      </div>
    </>
  );
}

function Section({ id, title, sum, collapsed, toggle, children }) {
  const isCol = !!collapsed[id];
  return (
    <div className={`section${isCol ? ' collapsed' : ''}`}>
      <div className="sec-head" onClick={() => toggle(id)}>
        <span className="chev">▾</span><p className="label">{title}</p><span className="sec-sum">{sum}</span>
      </div>
      <div className="sec-body">{children}</div>
    </div>
  );
}

function Slider({ label, val, min, max, step = 1, value, onChange }) {
  return (
    <div className="field">
      <label>{label} <span className="val">{val}</span></label>
      <div className="slider-row">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    </div>
  );
}
