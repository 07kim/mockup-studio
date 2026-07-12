// ============================================================================
// 汎用ユーティリティ
// ============================================================================

/** URL から素材名を生成（ホスト＋パス末尾）。 */
export function urlToName(url) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean);
    const last = seg.length ? seg[seg.length - 1].replace(/\.[a-z0-9]+$/i, '') : '';
    const host = u.hostname.replace(/^www\./, '');
    return last ? `${host}-${last}` : host;
  } catch {
    return 'page';
  }
}
