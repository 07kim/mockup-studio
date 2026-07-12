// ============================================================================
// 画像取り込みユーティリティ（クライアント）§3.1 / §13
// D&D・ファイル選択・クリップボード貼り付けに対応。HEIC は検出して案内。
// ============================================================================

const MAX_EDGE = 8000; // 最大辺（§13）
const MAX_BYTES = 40 * 1024 * 1024; // 1ファイル 40MB（§13）

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml'];

/** HEIC/HEIF 判定（拡張子 or MIME）。ブラウザで直接デコード不可（§3.1）。 */
export function isHeic(file) {
  const name = (file.name || '').toLowerCase();
  return (
    file.type === 'image/heic' || file.type === 'image/heif' ||
    name.endsWith('.heic') || name.endsWith('.heif')
  );
}

/** サポート対象の画像か。 */
export function isSupportedImage(file) {
  if (IMAGE_TYPES.includes(file.type)) return true;
  const n = (file.name || '').toLowerCase();
  return /\.(png|jpe?g|webp|avif|svg)$/.test(n);
}

/** File → HTMLImageElement（デコード完了まで待つ）。 */
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像の読み込みに失敗しました'));
    };
    img.src = url;
  });
}

/**
 * 巨大画像を上限へ縮小（§13）。縮小不要ならそのまま返す。
 * @returns {HTMLImageElement} 縮小後の画像（canvas 由来 or 元）
 */
export async function clampImageSize(img) {
  const maxEdge = Math.max(img.width, img.height);
  if (maxEdge <= MAX_EDGE) return img;
  const scale = MAX_EDGE / maxEdge;
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const out = new Image();
  await new Promise((res) => { out.onload = res; out.src = c.toDataURL('image/png'); });
  return out;
}

/**
 * File 群を取り込み、image item 用データ配列に変換。
 * @returns {Promise<{images:Array<{name:string,img:HTMLImageElement}>, skipped:Array<{name:string,reason:string}>}>}
 */
export async function importFiles(fileList) {
  const files = Array.from(fileList || []);
  const images = [];
  const skipped = [];
  for (const file of files) {
    if (isHeic(file)) {
      skipped.push({ name: file.name, reason: 'HEIC/HEIF は非対応。PNG/JPG に変換して再投入してください' });
      continue;
    }
    if (!isSupportedImage(file)) {
      skipped.push({ name: file.name, reason: '対応形式外（PNG/JPG/WebP/AVIF/SVG）' });
      continue;
    }
    if (file.size > MAX_BYTES) {
      skipped.push({ name: file.name, reason: 'ファイルサイズが上限(40MB)を超えています' });
      continue;
    }
    try {
      const { img } = await fileToImage(file);
      const clamped = await clampImageSize(img);
      images.push({ name: file.name, img: clamped });
    } catch (e) {
      skipped.push({ name: file.name, reason: e.message || '読み込み失敗' });
    }
  }
  return { images, skipped };
}

/** ClipboardEvent から画像を取り込み（Ctrl/Cmd+V）§3.1。 */
export async function importClipboard(clipboardData) {
  const items = Array.from(clipboardData?.items || []);
  const files = items
    .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
    .map((it) => it.getAsFile())
    .filter(Boolean);
  return importFiles(files);
}
