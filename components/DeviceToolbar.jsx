'use client';

import { groupNames, framesInGroup, groupOf, defaultDeviceForGroup, getFrame } from '@/lib/devices.js';

// 大分類ごとのアイコン（線画・20x20 viewBox）。中央プレビュー上の即時切替用。
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICON = {
  'スマートフォン': (<svg viewBox="0 0 24 24" {...S}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><line x1="10.5" y1="18.6" x2="13.5" y2="18.6" /></svg>),
  'タブレット': (<svg viewBox="0 0 24 24" {...S}><rect x="4" y="2.5" width="16" height="19" rx="2.5" /><line x1="10.5" y1="18.6" x2="13.5" y2="18.6" /></svg>),
  'ノートPC': (<svg viewBox="0 0 24 24" {...S}><rect x="4" y="4.5" width="16" height="11" rx="1.5" /><path d="M2 19h20l-1.6-2.5H3.6z" /></svg>),
  'モニター': (<svg viewBox="0 0 24 24" {...S}><rect x="3" y="4" width="18" height="12" rx="1.5" /><line x1="12" y1="16" x2="12" y2="19.5" /><line x1="8" y1="20" x2="16" y2="20" /></svg>),
  'ブラウザ': (<svg viewBox="0 0 24 24" {...S}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="8.5" x2="21" y2="8.5" /><circle cx="6" cy="6.2" r=".5" fill="currentColor" stroke="none" /><circle cx="8.2" cy="6.2" r=".5" fill="currentColor" stroke="none" /></svg>),
};
const ICON_PORTRAIT = (<svg viewBox="0 0 24 24" {...S}><rect x="7" y="3" width="10" height="18" rx="2.5" /></svg>);
const ICON_LANDSCAPE = (<svg viewBox="0 0 24 24" {...S}><rect x="3" y="7" width="18" height="10" rx="2.5" /></svg>);
const ICON_NOTCH = (<svg viewBox="0 0 24 24" {...S}><rect x="6" y="2.5" width="12" height="19" rx="3" /><rect x="9.5" y="4.6" width="5" height="1.8" rx=".9" fill="currentColor" stroke="none" /></svg>);

/**
 * 中央プレビュー上に浮かぶデバイス操作ツールバー（Blender風）。
 * 大分類アイコン → 機種 → 向き → ノッチ を、右メニューに行かず即座に切り替えられる。
 */
export default function DeviceToolbar({ item, settings, onSetDevice, onSetOrientation, onChange }) {
  if (!item || !item.img) return null;
  const frame = getFrame(item.device);
  const cats = groupNames();
  const curCat = groupOf(item.device);
  const models = framesInGroup(curCat);
  const hasNotch = !!frame.asset?.overlayImageUrl;
  const land = item.orientation === 'landscape';
  const notchOn = !settings.hideNotch;

  // 下段（機種・向き・ノッチ）を出すかどうか。デバイスによって出入りするが、
  // 上段の種類アイコンは常に同じ位置に固定される（下段は別行なので上段を動かさない）。
  const hasCtx = models.length > 1 || frame.canRotate || hasNotch;

  return (
    <div className="dtoolbar" role="toolbar" aria-label="デバイス">
      {/* 上段: デバイスの種類（常に5個・位置固定） */}
      <div className="dt-row">
        <div className="dt-group" aria-label="デバイスの種類">
          {cats.map((c) => (
            <button key={c} type="button" className={`dt-ico${c === curCat ? ' on' : ''}`}
              title={c} aria-label={c} aria-pressed={c === curCat}
              onClick={() => onSetDevice(item.id, defaultDeviceForGroup(c))}>
              {ICON[c] || <span style={{ fontSize: 11 }}>{c.slice(0, 2)}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 下段: 機種・向き・ノッチ（該当デバイスのみ） */}
      {hasCtx && (
        <div className="dt-row dt-ctx">
          {models.length > 1 && (
            <select className="dt-model" value={item.device} onChange={(e) => onSetDevice(item.id, e.target.value)} aria-label="機種">
              {models.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          )}
          {frame.canRotate && (
            <>
              {models.length > 1 && <span className="dt-div" />}
              <div className="dt-group" aria-label="向き">
                <button type="button" className={`dt-ico${!land ? ' on' : ''}`} title="縦向き" aria-pressed={!land} onClick={() => onSetOrientation(item.id, 'portrait')}>{ICON_PORTRAIT}</button>
                <button type="button" className={`dt-ico${land ? ' on' : ''}`} title="横向き" aria-pressed={land} onClick={() => onSetOrientation(item.id, 'landscape')}>{ICON_LANDSCAPE}</button>
              </div>
            </>
          )}
          {hasNotch && (
            <>
              {(models.length > 1 || frame.canRotate) && <span className="dt-div" />}
              <button type="button" className={`dt-ico${notchOn ? ' on' : ''}`}
                title={notchOn ? 'ノッチ・カメラを隠す' : 'ノッチ・カメラを表示'} aria-label="ノッチ・カメラ" aria-pressed={notchOn}
                onClick={() => onChange({ hideNotch: notchOn })}>
                {ICON_NOTCH}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
