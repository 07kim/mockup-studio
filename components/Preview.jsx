'use client';

import ItemCanvas from './ItemCanvas.jsx';
import RenderingIndicator from './RenderingIndicator.jsx';
import BgControl from './BgControl.jsx';

const PREVIEW_RS = 0.9;
const PREVIEW_N = 14;

/** 中央フォーカスプレビュー（§4 / §7）。 */
export default function Preview({ item, settings, bgImg, version, warnCount, onAddImage, onChange, onSetBg }) {
  if (!item) {
    return (
      <div className="stage-body">
        <button className="hero-drop" onClick={onAddImage}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
          </svg>
          <strong>画像をドラッグ＆ドロップ</strong>
          <span>または クリックして画像を選ぶ</span>
          <span className="sub">スクリーンショットを入れると、自動でスマホ／PCフレームに合成します</span>
        </button>
      </div>
    );
  }

  if (item.loading) {
    return <div className="stage-body"><RenderingIndicator estimate={6} /></div>;
  }
  if (item.error) {
    return <div className="stage-body"><div className="stage-empty"><p style={{ color: 'var(--danger)' }}>失敗: {item.error}</p><p>カードの「再描画」で再試行できます。</p></div></div>;
  }

  return (
    <div className="stage-body">
      <div className="checker">
        <ItemCanvas item={item} settings={settings} bgImg={bgImg} rs={PREVIEW_RS} N={PREVIEW_N} version={version} />
      </div>
      <BgControl settings={settings} onChange={onChange} onSetBg={onSetBg} />
      <div className="stage-tools">
        <span style={{ color: 'var(--ink)', fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
        {warnCount > 0 && <span className="warn-txt">警告 {warnCount}件</span>}
      </div>
    </div>
  );
}
