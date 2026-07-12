'use client';

import { useState } from 'react';
import { groupNames, groupOf, defaultDeviceForGroup } from '@/lib/devices.js';

/** 素材一覧（左ペイン）。カード＝チェック/サムネ/名前/デバイス/向き（§3.8 / §3.7）。 */
export default function ItemList(props) {
  const {
    items, focusedId, selectedIds, batchWarnings,
    onCardClick, onToggleSelect, onRename, onSetDevice, onSetOrientation,
    onSelectAll, onSelectNone, onRetry, onFixAll, onDelete, onReorder,
  } = props;

  const groups = groupNames();
  const warnIds = new Set(batchWarnings.map((w) => w.itemId));
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  return (
    <div>
      {items.length > 1 && (
        <div className="listbar">
          <span>{items.length} 件</span>
          <span className="sp" />
          <button className="link" onClick={onSelectAll}>すべて選択</button>
          <button className="link" onClick={onSelectNone}>選択を解除</button>
        </div>
      )}
      {items.length > 1 && (
        <div className="list-hint">クリックでプレビュー・チェックで複数選択</div>
      )}

      {batchWarnings.length > 0 && (
        <div className="listbar" style={{ marginTop: -4 }}>
          <span className="warn-txt">{batchWarnings[0].label}</span>
          <span className="sp" />
          <button className="link" onClick={() => onFixAll({ device: batchWarnings[0].majority })}>端末をそろえる</button>
        </div>
      )}


      <div className="items" role="listbox" aria-multiselectable="true" aria-label="素材一覧">
        {items.map((it) => {
          const selected = selectedIds.has(it.id);
          const focused = it.id === focusedId;
          return (
            <div
              key={it.id}
              className={`item${focused ? ' focused' : ''}${selected ? ' selected' : ''}${dragId === it.id ? ' dragging' : ''}${overId === it.id && dragId !== it.id ? ' drag-over' : ''}`}
              role="option" aria-selected={selected} tabIndex={0}
              onDragOver={(e) => { if (dragId == null) return; e.preventDefault(); if (overId !== it.id) setOverId(it.id); }}
              onDrop={(e) => { e.preventDefault(); if (dragId != null && dragId !== it.id) onReorder(dragId, it.id); setDragId(null); setOverId(null); }}
              onClick={(e) => onCardClick(it.id, e)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.querySelector('.item-name')?.focus(); e.preventDefault(); } }}
            >
              <div className="item-head">
                <span className="grip" title="ドラッグで並び替え" aria-hidden="true" draggable
                  onDragStart={(e) => { setDragId(it.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(it.id)); }}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  onClick={(e) => e.stopPropagation()}>⠿</span>
                <span className={`chk${selected ? ' on' : ''}`} role="checkbox" aria-checked={selected}
                  onClick={(e) => { e.stopPropagation(); onToggleSelect(it.id); }}>{selected ? '✓' : ''}</span>
                <span className="thumb">
                  {it.img ? <img src={it.img.src} alt={it.name} />
                    : it.loading ? '···' : it.error ? '⚠' : it.kind === 'html' ? 'URL' : it.kind}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input className="item-name" value={it.name} aria-label="名前"
                      onClick={(e) => e.stopPropagation()} onChange={(e) => onRename(it.id, e.target.value)} />
                    {focused && <span className="badge-focus">プレビュー中</span>}
                  </div>
                  <div className="item-sub">
                    {it.loading ? 'レンダリング中…'
                      : it.error ? <span style={{ color: 'var(--danger)' }}>失敗</span>
                      : it.img ? `${it.img.width}×${it.img.height}` : (it.kind === 'html' ? 'HTML' : it.kind)}
                  </div>
                </div>
                <button className="del" title="削除" aria-label="削除"
                  onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}>×</button>
              </div>
              <div className="item-body" onClick={(e) => e.stopPropagation()}>
                {/* 左は大分類のみ（機種・向き・ノッチは右パネルで選ぶ） */}
                <select value={groupOf(it.device)} onChange={(e) => onSetDevice(it.id, defaultDeviceForGroup(e.target.value))} aria-label="デバイスの種類">
                  {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                {it.kind === 'html' && <button className="mini-btn" onClick={() => onRetry(it.id)} disabled={it.loading}>再描画</button>}
                {warnIds.has(it.id) && <span className="warn-txt">他と違う端末</span>}
                {it.error && <button className="mini-btn" onClick={() => onRetry(it.id)}>再試行</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
