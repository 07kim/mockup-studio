'use client';

import { useEffect, useRef } from 'react';
import { renderItem } from '@/lib/engine.js';

/** item を canvas に合成して表示する共通コンポーネント（プレビュー/グリッド兼用）。 */
export default function ItemCanvas({ item, settings, bgImg, rs = 0.9, N = 14, version }) {
  const holderRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!item || !item.img) {
      if (holderRef.current) holderRef.current.innerHTML = '';
      return;
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      try {
        const canvas = renderItem(item, settings, rs, N, bgImg);
        const holder = holderRef.current;
        if (holder) { holder.innerHTML = ''; holder.appendChild(canvas); }
      } catch (e) {
        console.error('render failed', e);
      }
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [item, settings, bgImg, rs, N, version]);

  return <div ref={holderRef} style={{ display: 'contents' }} />;
}
