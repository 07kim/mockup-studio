# Mockup Studio

スクリーンショット・URL・HTMLプロジェクトを、デバイスフレームに合成して高品質な画像に変換するツール。
ポートフォリオ用に**複数素材を一括処理**できることを重視しています。

技術: **Next.js 14 (App Router) / JavaScript(JSX)**。合成エンジンは純関数（クライアント完結）。

---

## 実装状況（Phase 1〜9 実装済み）

- **P1 雛形**: Next.js プロジェクト、ダーク3カラムUI。
- **P2 合成エンジン** (`lib/engine.js`): 純関数。色導出（`lum`/`mixc`/palette）、`fitRect`、
  プログラム型フレーム描画（slab / laptop / monitor / browser）、3D傾き（遠近ワープ＋厚み側面・
  前面向き側面カリング）、アセット型 `drawAssetFrame`、背景・影・書き出し（PNG/JPG/SVG）、
  出力プリセット `wrapToSize`。CLI 用に `setCanvasFactory` で canvas を差し替え可能。単体テスト 27 件緑。
- **P3 画像→書き出し**: 自動デバイス判定、focus/selection 分離、チェックボックス＋修飾クリック、
  選択アクションバー、一括適用、警告（バッチ不一致／ソース品質）、ファイル名テンプレート
  （ライブプレビュー・トークンチップ）、トースト・Undo・キーボードショートカット・D&D・貼り付け。
- **P4 HTML レンダリング**: URL / フォルダ → 指定 viewport → PNG。`app/api/render/route.js`（Node）
  ＋ Playwright（`lib/browser.js` / `lib/folder-render.js`、§6.4 リクエスト傍受でメモリ内配信）。
  デバイス変更で再描画、失敗時は item 単位でエラー＋再描画。フォント待ち・同意バナー非表示・
  テーマ/フルページ対応。
- **P5 判定/命名/警告/UX**: P3 に含む（自動判定・命名・警告・a11y 床）。
- **P6 アセット型フレーム**: `drawAssetFrame`（screen背景→スクショ→base→overlay）。
  カスタムフレーム作成UI（`components/FrameStudio.jsx`、画面矩形ドラッグ・クロマキー透明化・
  JSON エクスポート/インポート・IndexedDB ならぬ localStorage 保存）。
- **P7 拡張**: マルチビューポート一括（URL→phone/tablet/desktop）、書き出しプリセット
  （App Store / OGP / SNS 等）、プロジェクト保存/読込（`.mockupproj` ZIP・設定＋素材＋カスタムフレーム同梱）。
- **P8 CLI**: `mockup.config.json` から一括生成（`cli/mockup.mjs`、`@napi-rs/canvas` で
  エンジンを Node 実行。画像/URL/フォルダ対応）。`node cli/mockup.mjs [config.json]`。
- **P9 デプロイ**: `next.config.mjs`（externalPackages）／`vercel.json`（maxDuration 60）／
  `SERVERLESS=1` で `@sparticuz/chromium` に切替（`lib/browser.js`）。

---

## セットアップ

```bash
npm install
npm run dev     # http://localhost:3000
```

### テスト

```bash
npm test        # node:test による engine/detect/filename/warnings の単体テスト
```

### 本番ビルド

```bash
npm run build
```

---

## ディレクトリ構成

```
app/
  layout.jsx / globals.css / page.jsx   メインUI（'use client'）
  api/render/route.js                   URL/フォルダ→PNG（Node ランタイム）
lib/
  engine.js         合成エンジン（純関数・canvas 差し替え可）
  devices.js        FrameDef 一覧 + viewport + 実解像度マップ + カスタム登録
  detect.js         自動デバイス判定
  filename.js       ファイル名テンプレ展開・サニタイズ・連番
  warnings.js       検証・警告の派生計算
  import.js         画像取り込み（D&D/貼り付け/HEIC検出/上限縮小）
  render-client.js  HTML item のクライアント側レンダリング呼び出し
  browser.js        Playwright 起動（ローカル/SERVERLESS 切替）
  folder-render.js  URL/フォルダ→PNG（リクエスト傍受）
  exporter.js       書き出し（ZIP・進捗・scale クランプ・プリセット）
  presets.js        書き出しプリセット
  project.js        プロジェクト保存/読込（.mockupproj）
  customFrames.js   カスタムフレーム保存/読込/登録
  defaults.js       既定 Settings・カラープリセット・localStorage
  utils.js          汎用
components/          SourceTabs / ItemList / Controls / Preview / Toasts / Shortcuts / FrameStudio
cli/mockup.mjs       CLI（mockup.config.json）
tests/               単体テスト
```

## CLI（バッチ生成）

`mockup.config.example.json` を参考に設定ファイルを作成し実行:

```bash
node cli/mockup.mjs mockup.config.json
# または  npm run mockup -- mockup.config.json
```

sources は `image`（ローカル画像）/ `url` / `folder` に対応。`style` で全体、各 source の
`style` で個別に上書きできます。

## Vercel デプロイ（§14.6）

1. GitHub に push → Vercel で Import（Framework: Next.js 自動）。
2. 環境変数に `SERVERLESS=1`（`@sparticuz/chromium` を使用）。
3. `vercel.json` で `/api/render` の `maxDuration` を 60s に設定済み。
4. 任意: `APP_TOKEN` と `NEXT_PUBLIC_APP_TOKEN` に同じ値を設定すると、ページを開いた人には
   自動でトークンが付与され、トークンなしのボット直叩きを 401 で弾く（§9）。
5. 任意: Vercel の Spend Management / 使用量アラートで青天井を防止。

## 使い方（MVP）

1. 画像をドラッグ&ドロップ、`画像を追加`、または `Cmd/Ctrl+V` で貼り付け。
2. 解像度から自動でデバイスを判定（手動変更可）。
3. 右パネルでフレーム色・フィット・3D傾き・背景・影・余白・書き出し設定を調整。
4. カードのチェックボックスで複数選択 → `選択を書き出し`（2件以上は自動で ZIP）。
5. `?` でショートカット一覧。破壊的操作は `Cmd/Ctrl+Z` で取り消し。

> プライバシー: 画像のフレーム化は完全にクライアント内で完結し、画像はサーバへ送信しません。
