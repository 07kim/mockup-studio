'use client';

import ItemCanvas from './ItemCanvas.jsx';
import { getFrame } from '@/lib/devices.js';

/** グリッド表示（全素材をサムネイルで一覧・§8）。 */
export default function Grid({ items, focusedId, selectedIds, warnIds, settingsFor, bgImg, version, onCardClick, onToggleSelect }) {
  return (
    <div className="grid">
      {items.map((it) => {
        const frame = getFrame(it.device);
        const selected = selectedIds.has(it.id);
        const orient = frame.canRotate ? (it.orientation === 'landscape' ? '横' : '縦') : '';
        return (
          <div
            key={it.id}
            className={`gcard${selected ? ' selected' : ''}${it.id === focusedId ? ' focused' : ''}`}
            onClick={(e) => onCardClick(it.id, e)}
          >
            <span className="gchk" onClick={(e) => { e.stopPropagation(); onToggleSelect(it.id); }}>
              <span className={`chk${selected ? ' on' : ''}`}>{selected ? '✓' : ' '}</span>
            </span>
            <div className="gstage">
              {it.loading ? <span className="ph">レンダリング中…</span>
                : it.error ? <span className="ph" style={{ color: 'var(--danger)' }}>失敗</span>
                : it.img ? <ItemCanvas item={it} settings={settingsFor(it)} bgImg={bgImg} rs={0.4} N={10} version={version} />
                : <span className="ph">{it.kind}</span>}
            </div>
            <div className="gname">{it.name}{warnIds?.has(it.id) && <span className="warn-txt">警告</span>}</div>
            <div className="gsub">{frame.label}{orient ? ` · ${orient}` : ''}</div>
          </div>
        );
      })}
    </div>
  );
}
