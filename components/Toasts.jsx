'use client';

/** トースト表示（§4.1 システム状態の可視化・aria-live）。 */
export default function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind === 'err' ? 'err' : 'ok'}`} role="status">
          <span style={{ flex: 1 }}>{t.message}</span>
          {t.action && (
            <button onClick={() => { t.action.run(); onDismiss(t.id); }}>{t.action.label}</button>
          )}
          <button onClick={() => onDismiss(t.id)} aria-label="閉じる">✕</button>
        </div>
      ))}
    </div>
  );
}
