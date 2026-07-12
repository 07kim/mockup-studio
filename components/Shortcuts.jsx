'use client';

const ROWS = [
  ['↑ / ↓', 'プレビュー対象を移動'],
  ['Space', '選択のトグル'],
  ['Shift + ↑/↓', '範囲選択'],
  ['Cmd/Ctrl + クリック', '選択の追加/解除'],
  ['Shift + クリック', '範囲選択'],
  ['Cmd/Ctrl + A', '全選択'],
  ['Delete / Backspace', '削除'],
  ['Enter', 'リネーム'],
  ['Cmd/Ctrl + S', '選択を書き出し'],
  ['Cmd/Ctrl + Z', '元に戻す'],
  ['Esc', '選択解除 / 閉じる'],
  ['?', 'このヘルプ'],
];

/** ショートカット一覧オーバーレイ（§4.1）。 */
export default function Shortcuts({ onClose }) {
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="ショートカット一覧">
      <div className="panel-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>キーボードショートカット</h3>
        <table>
          <tbody>
            {ROWS.map(([k, d]) => (
              <tr key={k}><td><kbd>{k}</kbd></td><td>{d}</td></tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
