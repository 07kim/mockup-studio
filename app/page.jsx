'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/lib/defaults.js';
import { detectDevice } from '@/lib/detect.js';
import { importFiles, importClipboard } from '@/lib/import.js';
import { exportItems, downloadBlob, nowTokens } from '@/lib/exporter.js';
import { saveProject, loadProject } from '@/lib/project.js';
import { batchMismatchWarnings, allSourceWarnings } from '@/lib/warnings.js';
import { renderHtmlItem } from '@/lib/render-client.js';
import { getFrame } from '@/lib/devices.js';
import { loadAndRegister, loadBuiltinAssetFrames } from '@/lib/customFrames.js';
import { urlToName } from '@/lib/utils.js';
import SourceTabs from '@/components/SourceTabs.jsx';
import ItemList from '@/components/ItemList.jsx';
import Controls from '@/components/Controls.jsx';
import Preview from '@/components/Preview.jsx';
import DeviceToolbar from '@/components/DeviceToolbar.jsx';
import Grid from '@/components/Grid.jsx';
import ItemCanvas from '@/components/ItemCanvas.jsx';
import RenderingIndicator from '@/components/RenderingIndicator.jsx';
import UrlStage from '@/components/UrlStage.jsx';
import Toasts from '@/components/Toasts.jsx';
import Shortcuts from '@/components/Shortcuts.jsx';
import FrameStudio from '@/components/FrameStudio.jsx';
import ExportDialog from '@/components/ExportDialog.jsx';

let NEXT_ID = 1;

const initialUI = { items: [], focusedId: null, selectedIds: new Set(), lastAnchorId: null, bgImg: null };

function uiReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEMS':
      return { ...state, items: state.items.concat(action.items), focusedId: state.focusedId ?? action.items[0]?.id ?? null };
    case 'UPDATE_ITEM':
      return { ...state, items: state.items.map((it) => (it.id === action.id ? { ...it, ...action.patch } : it)) };
    case 'FOCUS':
      return { ...state, focusedId: action.id };
    case 'SET_SELECTED':
      return { ...state, selectedIds: action.ids, lastAnchorId: action.anchor ?? state.lastAnchorId };
    case 'DELETE': {
      const items = state.items.filter((it) => !action.ids.has(it.id));
      const selectedIds = new Set([...state.selectedIds].filter((id) => !action.ids.has(id)));
      const focusedId = action.ids.has(state.focusedId) ? (items[0]?.id ?? null) : state.focusedId;
      return { ...state, items, selectedIds, focusedId };
    }
    case 'REORDER': {
      const items = [...state.items];
      const from = items.findIndex((it) => it.id === action.fromId);
      const to = items.findIndex((it) => it.id === action.toId);
      if (from < 0 || to < 0 || from === to) return state;
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return { ...state, items };
    }
    case 'SET_BG': return { ...state, bgImg: action.img };
    case 'RESTORE': return { ...action.snapshot };
    default: return state;
  }
}

export default function Page() {
  const [ui, dispatch] = useReducer(uiReducer, initialUI);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [overrides, setOverrides] = useState({});
  const [view, setView] = useState('focus'); // 'focus' | 'grid'
  const [urlSession, setUrlSession] = useState(null); // { url, device, orientation } | null（URL取り込みモード）
  const [lastCapturedId, setLastCapturedId] = useState(null); // 直近に追加した画面（プレビュー用）
  const [toasts, setToasts] = useState([]);
  const [busy, setBusy] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showFrameStudio, setShowFrameStudio] = useState(false);
  const [framesVersion, setFramesVersion] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const undoStack = useRef([]);
  const itemsRef = useRef(ui.items);
  const imgPickRef = useRef(null); // 中央ヒーローCTA用の共有ファイル入力
  useEffect(() => { itemsRef.current = ui.items; }, [ui.items]);

  useEffect(() => { setSettings(loadSettings()); }, []);
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => {
    Promise.all([loadBuiltinAssetFrames(), loadAndRegister()])
      .then(() => setFramesVersion((v) => v + 1))
      .catch(() => {});
  }, []);

  const focusedItem = ui.items.find((it) => it.id === ui.focusedId) || null;
  const selCount = ui.selectedIds.size;

  // URL/フォーカスが変わったら直近プレビューをリセット
  useEffect(() => { setLastCapturedId(null); }, [ui.focusedId]);

  // ---- 実効設定（ベース＋item別override）----
  const effSettings = useCallback((item) => (item && overrides[item.id] ? { ...settings, ...overrides[item.id] } : settings), [settings, overrides]);

  // 設定は「基本個別」＝変更は常にフォーカス中の1件に反映（override）。
  // 素材が無い/未選択のときはベース設定を更新。
  const applySetting = useCallback((patch) => {
    if (ui.focusedId == null) { setSettings((s) => ({ ...s, ...patch })); return; }
    setOverrides((ov) => ({ ...ov, [ui.focusedId]: { ...(ov[ui.focusedId] || {}), ...patch } }));
  }, [ui.focusedId]);

  // 「全てに反映」= フォーカス中の設定を全 item へ（ベース化＋override 消去）
  const applyToAll = useCallback(() => {
    if (!focusedItem) return;
    const eff = effSettings(focusedItem);
    setSettings(eff); setOverrides({});
    pushToast({ kind: 'ok', message: 'すべての素材に反映しました' });
  }, [focusedItem, effSettings]);

  // 「選択に反映」= フォーカス中の設定を選択中の item へ
  const applyToSelected = useCallback(() => {
    if (!focusedItem || selCount === 0) return;
    const eff = effSettings(focusedItem);
    setOverrides((ov) => { const n = { ...ov }; for (const id of ui.selectedIds) n[id] = { ...eff }; return n; });
    pushToast({ kind: 'ok', message: `選択中の ${selCount} 件に反映しました` });
  }, [focusedItem, selCount, ui.selectedIds, effSettings]);

  // Controls に表示する設定＝フォーカス中の実効設定
  const displayedSettings = focusedItem ? effSettings(focusedItem) : settings;

  // 書き出し設定（形式/解像度/サイズ/ファイル名）は全体共通。ベース更新＋override から該当キー除去。
  const setExport = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }));
    setOverrides((ov) => {
      const keys = Object.keys(patch); const next = {};
      for (const [id, o] of Object.entries(ov)) { const c = { ...o }; keys.forEach((k) => delete c[k]); if (Object.keys(c).length) next[id] = c; }
      return next;
    });
  }, []);

  // ---- トースト / Undo ----
  const pushToast = useCallback((t) => {
    const id = NEXT_ID++;
    setToasts((ts) => [...ts, { id, ...t }]);
    if (!t.action) setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback((id) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);
  const snapshot = useCallback(() => { undoStack.current.push({ ...ui, selectedIds: new Set(ui.selectedIds) }); if (undoStack.current.length > 20) undoStack.current.shift(); }, [ui]);
  const undo = useCallback(() => { const s = undoStack.current.pop(); if (s) { dispatch({ type: 'RESTORE', snapshot: s }); pushToast({ kind: 'ok', message: '元に戻しました' }); } }, [pushToast]);

  // ---- 取り込み ----
  const addImages = useCallback(async (images, skipped) => {
    const items = images.map(({ name, img }) => {
      const det = detectDevice(img.width, img.height);
      const cleanName = name.replace(/\.[^.]+$/, '') || name; // 拡張子を除いた素材名
      return { id: NEXT_ID++, kind: 'image', name: cleanName, img, device: det.device, orientation: det.orientation };
    });
    if (items.length) dispatch({ type: 'ADD_ITEMS', items });
    (skipped || []).forEach((s) => pushToast({ kind: 'err', message: `${s.name}: ${s.reason}` }));
    if (items.length) pushToast({ kind: 'ok', message: `${items.length}件を追加しました` });
  }, [pushToast]);
  const handleFiles = useCallback(async (fl) => { const { images, skipped } = await importFiles(fl); await addImages(images, skipped); }, [addImages]);

  // ---- HTML レンダリング ----
  const runRender = useCallback(async (item) => {
    dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { loading: true, error: null } });
    try {
      const img = await renderHtmlItem(item);
      dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { img, loading: false, error: null } });
    } catch (e) {
      dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { loading: false, error: e.message } });
      pushToast({ kind: 'err', message: `${item.name}: ${e.message}` });
    }
  }, [pushToast]);
  const retryHtml = useCallback((id) => { const it = itemsRef.current.find((x) => x.id === id); if (it && it.kind === 'html') runRender(it); }, [runRender]);

  // URL は「操作して撮る」取り込みモードを開く（一覧アイテムにはしない）
  const addUrl = useCallback(({ url }) => {
    setUrlSession({ url, device: 'browser', orientation: 'portrait' });
    setLastCapturedId(null);
  }, []);

  const addFolder = useCallback(({ files, entry, device, orientation, renderOpts }) => {
    const item = {
      id: NEXT_ID++, kind: 'html', name: (entry || 'site').replace(/\.html?$/i, '') || 'site',
      source: { type: 'folder', files, entry }, device: device || 'browser',
      orientation: getFrame(device || 'browser').canRotate ? (orientation || 'portrait') : 'portrait',
      renderOpts: renderOpts || {}, loading: true,
    };
    dispatch({ type: 'ADD_ITEMS', items: [item] });
    runRender(item);
  }, [runRender]);

  // ---- URL 操作セッションから「この画面を追加」= 現在のスクショを画像素材として追加 ----
  const addCapturedImage = useCallback((dataUrl, srcUrl, device) => {
    const img = new Image();
    img.onload = () => {
      const id = NEXT_ID++;
      dispatch({ type: 'ADD_ITEMS', items: [{ id, kind: 'image', name: urlToName(srcUrl || 'page'), img, device: device || 'browser', orientation: 'portrait' }] });
      setLastCapturedId(id);
      pushToast({ kind: 'ok', message: '画面を追加しました' });
    };
    img.src = dataUrl;
  }, [pushToast]);

  // 撮影オプション（URL/フォルダ item の renderOpts 編集）
  const updateRenderOpts = useCallback((patch) => {
    const it = focusedItem;
    if (!it) return;
    dispatch({ type: 'UPDATE_ITEM', id: it.id, patch: { renderOpts: { ...(it.renderOpts || {}), ...patch } } });
  }, [focusedItem]);

  // ---- D&D / paste ----
  useEffect(() => {
    const over = (e) => { e.preventDefault(); setDragActive(true); };
    const leave = (e) => { if (e.relatedTarget === null) setDragActive(false); };
    const drop = (e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files); };
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); };
  }, [handleFiles]);
  useEffect(() => {
    const paste = async (e) => { const { images, skipped } = await importClipboard(e.clipboardData); if (images.length || skipped.length) await addImages(images, skipped); };
    window.addEventListener('paste', paste); return () => window.removeEventListener('paste', paste);
  }, [addImages]);

  // ---- 選択 ----
  const setSelected = useCallback((ids, anchor) => dispatch({ type: 'SET_SELECTED', ids: new Set(ids), anchor }), []);
  const toggleSelect = useCallback((id) => { const n = new Set(ui.selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelected(n, id); }, [ui.selectedIds, setSelected]);
  const rangeSelect = useCallback((id) => {
    const ids = ui.items.map((it) => it.id); const a = ids.indexOf(ui.lastAnchorId ?? id); const b = ids.indexOf(id);
    const [lo, hi] = a < b ? [a, b] : [b, a]; setSelected(new Set([...ui.selectedIds, ...ids.slice(lo, hi + 1)]), ui.lastAnchorId ?? id);
  }, [ui.items, ui.selectedIds, ui.lastAnchorId, setSelected]);
  const selectAll = useCallback(() => setSelected(new Set(ui.items.map((it) => it.id))), [ui.items, setSelected]);
  const selectNone = useCallback(() => setSelected(new Set()), [setSelected]);
  const onCardClick = useCallback((id, e) => {
    if (e.metaKey || e.ctrlKey) return toggleSelect(id); // 追加選択
    if (e.shiftKey) return rangeSelect(id); // 範囲選択
    // 通常クリック＝その1件だけを対象に（複数選択はリセット）
    dispatch({ type: 'FOCUS', id });
    setSelected(new Set([id]), id);
  }, [toggleSelect, rangeSelect, setSelected]);

  // ---- 破壊的操作 ----
  const deleteItems = useCallback((ids) => { if (!ids.size) return; snapshot(); dispatch({ type: 'DELETE', ids }); pushToast({ kind: 'ok', message: `${ids.size}件を削除しました`, action: { label: '元に戻す', run: undo } }); }, [snapshot, pushToast, undo]);
  const duplicateItems = useCallback((ids) => { const d = ui.items.filter((it) => ids.has(it.id)).map((it) => ({ ...it, id: NEXT_ID++, name: `${it.name}-copy` })); if (d.length) dispatch({ type: 'ADD_ITEMS', items: d }); }, [ui.items]);
  const deleteOne = useCallback((id) => deleteItems(new Set([id])), [deleteItems]);
  const moveItem = useCallback((fromId, toId) => { if (fromId === toId) return; snapshot(); dispatch({ type: 'REORDER', fromId, toId }); }, [snapshot]);
  const fixAllDevice = useCallback((patch) => { snapshot(); for (const it of ui.items) { dispatch({ type: 'UPDATE_ITEM', id: it.id, patch }); if (it.kind === 'html') runRender({ ...it, ...patch }); } pushToast({ kind: 'ok', message: '端末をそろえました', action: { label: '元に戻す', run: undo } }); }, [ui.items, snapshot, undo, pushToast, runRender]);

  const renameItem = useCallback((id, name) => dispatch({ type: 'UPDATE_ITEM', id, patch: { name } }), []);
  const setItemDevice = useCallback((id, device) => { const it = itemsRef.current.find((x) => x.id === id); const patch = { device }; if (!getFrame(device).canRotate) patch.orientation = 'portrait'; dispatch({ type: 'UPDATE_ITEM', id, patch }); if (it && it.kind === 'html') runRender({ ...it, ...patch }); }, [runRender]);
  const setItemOrientation = useCallback((id, orientation) => { const it = itemsRef.current.find((x) => x.id === id); dispatch({ type: 'UPDATE_ITEM', id, patch: { orientation } }); if (it && it.kind === 'html') runRender({ ...it, orientation }); }, [runRender]);

  // ---- 書き出し ----
  const doExport = useCallback(async (items) => {
    if (!items.length) { pushToast({ kind: 'err', message: '書き出す item がありません' }); return; }
    setBusy({ label: '書き出し中', done: 0, total: items.length });
    try {
      const r = await exportItems(items, settings, ui.bgImg, (done, total) => setBusy({ label: '書き出し中', done, total }), effSettings);
      downloadBlob(r.blob, r.filename);
      const msg = r.single ? `「${r.filename}」を書き出しました` : `${items.length}件を ZIP で書き出しました`;
      pushToast({ kind: 'ok', message: r.downgraded ? `${msg}（一部 scale 降格）` : msg });
    } catch (e) { pushToast({ kind: 'err', message: `書き出し失敗: ${e.message}` }); }
    finally { setBusy(null); }
  }, [settings, ui.bgImg, effSettings, pushToast]);
  const exportSelected = useCallback(() => doExport(ui.items.filter((it) => ui.selectedIds.has(it.id))), [ui.items, ui.selectedIds, doExport]);
  const exportAll = useCallback(() => doExport(ui.items), [ui.items, doExport]);

  // ---- プロジェクト ----
  const doSaveProject = useCallback(async () => {
    try { const blob = await saveProject(ui.items, settings, ui.bgImg, overrides); const { date, time } = nowTokens(); downloadBlob(blob, `project_${date}-${time}.mockupproj`); pushToast({ kind: 'ok', message: 'プロジェクトを保存しました' }); }
    catch (e) { pushToast({ kind: 'err', message: `保存失敗: ${e.message}` }); }
  }, [ui.items, ui.bgImg, settings, overrides, pushToast]);
  const doLoadProject = useCallback(async (file) => {
    if (!file) return;
    try {
      const { items, settings: st, bgImg, overrides: ov } = await loadProject(file);
      const withIds = items.map((it) => ({ ...it, id: NEXT_ID++ }));
      const newOv = {}; withIds.forEach((it) => { if (ov && ov[it._oldId]) newOv[it.id] = ov[it._oldId]; });
      dispatch({ type: 'RESTORE', snapshot: { items: withIds, focusedId: withIds[0]?.id ?? null, selectedIds: new Set(), lastAnchorId: null, bgImg } });
      if (st) setSettings((s) => ({ ...s, ...st }));
      setOverrides(newOv); setFramesVersion((v) => v + 1);
      pushToast({ kind: 'ok', message: `プロジェクトを読み込みました（${withIds.length}件）` });
    } catch (e) { pushToast({ kind: 'err', message: `読込失敗: ${e.message}` }); }
  }, [pushToast]);

  // ---- ショートカット ----
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); return selectAll(); }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); return exportSelected(); }
      if (e.key === '?') return setShowShortcuts((v) => !v);
      if (e.key === 'Escape') { setShowShortcuts(false); return selectNone(); }
      if (typing) return;
      const ids = ui.items.map((it) => it.id); const cur = ids.indexOf(ui.focusedId);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); const next = ids[Math.max(0, Math.min(ids.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (next != null) { dispatch({ type: 'FOCUS', id: next }); if (e.shiftKey) rangeSelect(next); }
      } else if (e.key === ' ' && ui.focusedId != null) { e.preventDefault(); toggleSelect(ui.focusedId); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteItems(ui.selectedIds.size ? ui.selectedIds : (ui.focusedId != null ? new Set([ui.focusedId]) : new Set())); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [ui.items, ui.focusedId, ui.selectedIds, undo, selectAll, selectNone, exportSelected, rangeSelect, toggleSelect, deleteItems]);

  // ---- 警告 ----
  const batchWarnings = useMemo(() => batchMismatchWarnings(ui.items, settings), [ui.items, settings]);
  const sourceWarnings = useMemo(() => allSourceWarnings(ui.items, settings), [ui.items, settings]);
  const warnIds = useMemo(() => new Set([...batchWarnings, ...sourceWarnings].map((w) => w.itemId)), [batchWarnings, sourceWarnings]);
  const focusWarnCount = focusedItem ? (batchWarnings.concat(sourceWarnings).filter((w) => w.itemId === focusedItem.id).length) : 0;

  // URL 取り込み中の小プレビュー＝直近に追加した画面
  const previewItem = (lastCapturedId != null && ui.items.find((i) => i.id === lastCapturedId)) || null;

  return (
    <>
      <header className="top">
        <div className="brand"><span className="mark" /><h1>Mockup Studio</h1></div>
        <div className="top-center">
          {ui.items.length > 0 && (
            <div className="seg">
              <button className={view === 'focus' ? 'on' : ''} onClick={() => setView('focus')}>1つずつ</button>
              <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>一覧</button>
            </div>
          )}
        </div>
        <div className="top-right">
          <button className="btn sm" onClick={() => setShowFrameStudio(true)}>フレーム作成</button>
          <span className="count">{ui.items.length} 件</span>
        </div>
      </header>

      <div className="layout">
        {/* LEFT */}
        <div className="col">
          <div className="pane">
            <SourceTabs onFiles={handleFiles} onAddUrl={addUrl} onAddFolder={addFolder} busy={busy} />
            <div style={{ height: 14 }} />
            <ItemList
              items={ui.items} focusedId={ui.focusedId} selectedIds={ui.selectedIds} batchWarnings={batchWarnings}
              onCardClick={onCardClick} onToggleSelect={toggleSelect} onRename={renameItem}
              onSetDevice={setItemDevice} onSetOrientation={setItemOrientation}
              onSelectAll={selectAll} onSelectNone={selectNone} onRetry={retryHtml} onFixAll={fixAllDevice}
              onDelete={deleteOne} onReorder={moveItem}
            />
          </div>
        </div>

        {/* CENTER */}
        <div className="col stage">
          {selCount > 1 && (
            <div className="selbar">
              <span>{selCount} 件を選択中</span>
              <button className="btn sm" onClick={exportSelected}>書き出し</button>
              <button className="btn sm" onClick={() => duplicateItems(ui.selectedIds)}>複製</button>
              <button className="btn sm danger" onClick={() => deleteItems(ui.selectedIds)}>削除</button>
              <span className="sp" />
              <button className="btn sm" onClick={selectNone}>選択を解除</button>
            </div>
          )}

          {/* 画面上部の固定デバイスバー（1つずつ表示・素材フォーカス時） */}
          {!urlSession && view !== 'grid' && focusedItem && (
            <DeviceToolbar item={focusedItem} settings={effSettings(focusedItem)}
              onSetDevice={setItemDevice} onSetOrientation={setItemOrientation} onChange={applySetting} />
          )}

          {urlSession ? (
            <UrlStage
              session={urlSession} onSessionChange={setUrlSession}
              onCapture={addCapturedImage} onClose={() => setUrlSession(null)} pushToast={pushToast}
              previewItem={previewItem} previewSettings={previewItem ? effSettings(previewItem) : settings}
              bgImg={ui.bgImg} version={framesVersion}
            />
          ) : view === 'grid' ? (
            <Grid items={ui.items} focusedId={ui.focusedId} selectedIds={ui.selectedIds} warnIds={warnIds}
              settingsFor={effSettings} bgImg={ui.bgImg} version={framesVersion}
              onCardClick={onCardClick} onToggleSelect={toggleSelect} />
          ) : (
            <Preview item={focusedItem} settings={focusedItem ? effSettings(focusedItem) : settings} bgImg={ui.bgImg} version={framesVersion} warnCount={focusWarnCount} onAddImage={() => imgPickRef.current?.click()}
              onChange={applySetting} onSetBg={(img) => dispatch({ type: 'SET_BG', img })} />
          )}
        </div>

        {/* RIGHT */}
        <div className="col right">
          <Controls
            settings={displayedSettings} onChange={applySetting}
            onApplyAll={applyToAll} onApplySelected={applyToSelected}
            selCount={selCount} totalCount={ui.items.length}
            focusedItem={focusedItem}
            onUpdateRenderOpts={updateRenderOpts} onRerender={() => retryHtml(ui.focusedId)}
            onOpenExport={() => setShowExport(true)}
            onSaveProject={doSaveProject} onLoadProject={doLoadProject} busy={busy}
          />
        </div>
      </div>

      <input ref={imgPickRef} type="file" multiple style={{ display: 'none' }}
        accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      {dragActive && <div className="dropzone">ここにドロップして画像を追加</div>}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      {showShortcuts && <Shortcuts onClose={() => setShowShortcuts(false)} />}
      {showFrameStudio && <FrameStudio onClose={() => setShowFrameStudio(false)} onChanged={() => setFramesVersion((v) => v + 1)} pushToast={pushToast} />}
      {showExport && (
        <ExportDialog
          settings={settings} setExport={setExport}
          totalCount={ui.items.length} selCount={selCount} focusedItem={focusedItem}
          busy={busy}
          onExport={async (target) => {
            const items = target === 'selected' ? ui.items.filter((it) => ui.selectedIds.has(it.id)) : ui.items;
            await doExport(items);
            setShowExport(false);
          }}
          onClose={() => setShowExport(false)}
        />
      )}
    </>
  );
}
