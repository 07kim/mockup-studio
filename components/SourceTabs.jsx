'use client';

import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';

/**
 * 素材の追加メニュー（Google ドライブ風）。
 * 「＋ 追加」ボタン → メニュー（画像 / フォルダ / ZIP / URL）。1つの入口で分かりやすく。
 */
export default function SourceTabs({ onFiles, onAddUrl, onAddFolder, busy }) {
  const fileRef = useRef(null);
  const folderRef = useRef(null);
  const zipRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  const submitUrl = () => {
    if (!url.trim()) return;
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    onAddUrl({ url: u, devices: ['browser'], orientation: 'portrait', renderOpts: {} });
    setUrl('');
    setUrlOpen(false);
  };

  const handleFolder = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const rels = files.map((f) => f.webkitRelativePath || f.name);
    const top = rels[0].split('/')[0];
    const allSameTop = rels.every((r) => r.split('/')[0] === top && r.includes('/'));
    const entries = files.map((f, i) => ({ file: f, path: allSameTop ? rels[i].slice(top.length + 1) : rels[i] }));
    onAddFolder({ files: entries, entry: pickEntry(entries.map((e) => e.path)), device: 'browser', orientation: 'portrait', renderOpts: {} });
  };

  const handleZip = async (file) => {
    if (!file) return;
    const zip = await JSZip.loadAsync(file);
    const entries = [], names = [];
    await Promise.all(Object.values(zip.files).map(async (zf) => {
      if (zf.dir) return;
      const bytes = await zf.async('blob');
      const path = zf.name.replace(/^[^/]+\//, '');
      entries.push({ file: new File([bytes], path.split('/').pop(), { type: '' }), path });
      names.push(path);
    }));
    onAddFolder({ files: entries, entry: pickEntry(names), device: 'browser', orientation: 'portrait', renderOpts: {} });
  };

  const pick = (ref) => { setOpen(false); ref.current?.click(); };

  return (
    <div className="addmenu" onClick={(e) => e.stopPropagation()}>
      <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
        accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      <input ref={folderRef} type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }}
        onChange={(e) => { handleFolder(e.target.files); e.target.value = ''; }} />
      <input ref={zipRef} type="file" accept=".zip" style={{ display: 'none' }}
        onChange={(e) => { handleZip(e.target.files?.[0]); e.target.value = ''; }} />

      <button className="add-btn" onClick={() => { setOpen((v) => !v); setUrlOpen(false); }} aria-haspopup="menu" aria-expanded={open}>
        <Ico p="M12 5v14M5 12h14" /> 追加
      </button>

      {open && (
        <div className="add-pop" role="menu">
          <button role="menuitem" onClick={() => pick(fileRef)}>
            <Ico p="M4 5h16v14H4zM4 15l4-4 3 3 4-5 5 6" /> <span>画像をアップロード</span>
          </button>
          <button role="menuitem" onClick={() => pick(folderRef)}>
            <Ico p="M3 7h6l2 2h10v10H3z" /> <span>フォルダをアップロード</span>
          </button>
          <button role="menuitem" onClick={() => pick(zipRef)}>
            <Ico p="M3 7h6l2 2h10v10H3zM12 11v6M10 13h4" /> <span>ZIP をアップロード</span>
          </button>
          <div className="add-div" />
          <button role="menuitem" onClick={() => { setOpen(false); setUrlOpen(true); }}>
            <Ico p="M9 15l6-6M8 12l-2 2a3 3 0 004 4l2-2M16 12l2-2a3 3 0 00-4-4l-2 2" /> <span>URL から取り込む</span>
          </button>
        </div>
      )}

      {urlOpen && (
        <div className="add-url" style={{ marginTop: 10 }}>
          <input type="url" placeholder="https://…" autoFocus value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitUrl(); if (e.key === 'Escape') setUrlOpen(false); }} />
          <button className="btn sm" disabled={!url.trim() || !!busy} onClick={submitUrl}>取込</button>
        </div>
      )}

      <p className="add-hint">ドラッグ＆ドロップ / 貼り付け でも追加できます</p>
    </div>
  );
}

function Ico({ p }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={p} />
    </svg>
  );
}

function pickEntry(paths) {
  if (paths.includes('index.html')) return 'index.html';
  const html = paths.filter((p) => p.toLowerCase().endsWith('.html'));
  html.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
  return html[0] || 'index.html';
}
