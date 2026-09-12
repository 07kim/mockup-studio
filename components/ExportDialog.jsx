'use client';

import { useState } from 'react';
import { expandTemplate, withExt } from '@/lib/filename.js';
import { nowTokens } from '@/lib/exporter.js';
import { EXPORT_PRESETS } from '@/lib/presets.js';

/**
 * 書き出しダイアログ（Adobe 風・書き出し時に設定）。
 * 対象・形式・解像度・サイズ・ファイル名をまとめて指定して書き出す。
 */
export default function ExportDialog({ settings, setExport, totalCount, selCount, focusedItem, onExport, onClose, busy }) {
  const [target, setTarget] = useState(selCount > 1 ? 'selected' : 'all');
  const set = (patch) => setExport(patch);

  const nameMode = settings.nameMode || 'original';
  const nameBase = settings.nameBase || '';
  const nameNumber = !!settings.nameNumber;
  const buildName = (mode, base, number) => {
    let s = mode === 'custom' ? ((base && base.trim()) ? base.trim() : 'mockup') : '{name}';
    if (number) s += '_{index}';
    set({ nameMode: mode, nameBase: base, nameNumber: number, filenameTemplate: s });
  };

  const { date, time } = nowTokens();
  const previewName = focusedItem
    ? withExt(expandTemplate(settings.filenameTemplate, { item: focusedItem, settings, index: 1, indexPad: settings.indexPad, date, time, format: settings.format, scale: settings.scale }), settings.format)
    : `mockup.${settings.format}`;

  const count = target === 'selected' ? selCount : totalCount;

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="書き出し">
      <div className="panel-box" style={{ maxWidth: 380, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h3>書き出し</h3>

        <div className="field"><label>対象</label>
          <div className="seg full">
            <button className={target === 'all' ? 'on' : ''} onClick={() => setTarget('all')}>すべて ({totalCount})</button>
            <button className={target === 'selected' ? 'on' : ''} disabled={selCount === 0} onClick={() => setTarget('selected')}>選択中 ({selCount})</button>
          </div>
        </div>

        <div className="field"><label>形式</label>
          <div className="seg full">{['png', 'jpg', 'svg'].map((f) => <button key={f} className={settings.format === f ? 'on' : ''} onClick={() => set({ format: f })}>{f.toUpperCase()}</button>)}</div>
        </div>

        <div className="field"><label>解像度</label>
          <div className="seg full">
            {['auto', 1, 2, 3, 4].map((s) => (
              <button
                key={s}
                className={settings.scale === s ? 'on' : ''}
                onClick={() => set({ scale: s })}
                title={s === 'auto' ? '元画像の解像度を100%維持して最高画質で書き出します' : `${s}倍スケール`}
              >
                {s === 'auto' ? 'Auto (原寸)' : `${s}x`}
              </button>
            ))}
          </div>
        </div>

        <div className="field"><label>サイズを揃える（任意）</label>
          <select value={settings.preset || 'none'} onChange={(e) => set({ preset: e.target.value })}>
            {EXPORT_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        <div className="field"><label>ファイル名</label>
          <div className="seg full">
            <button className={nameMode === 'original' ? 'on' : ''} onClick={() => buildName('original', nameBase, nameNumber)}>元の名前</button>
            <button className={nameMode === 'custom' ? 'on' : ''} onClick={() => buildName('custom', nameBase, true)}>新しい名前</button>
          </div>
          {nameMode === 'custom' && (
            <input type="text" style={{ marginTop: 8 }} placeholder="例: myapp" value={nameBase} onChange={(e) => buildName('custom', e.target.value, true)} />
          )}
          <label className="switch" style={{ marginTop: 8 }} onClick={() => buildName(nameMode, nameBase, !nameNumber)}>
            <span className={`sw-track${nameNumber ? ' on' : ''}`}><span className="sw-knob" /></span> 連番をつける（_01, _02…）
          </label>
          <div className="tpl-prev">例: {previewName}</div>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
          <button className="primary" style={{ flex: 2 }} disabled={count === 0 || !!busy} onClick={() => onExport(target)}>
            {busy ? '書き出し中…' : `${count} 件を書き出す`}
          </button>
        </div>
      </div>
    </div>
  );
}
