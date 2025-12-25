# Mock Job Demo (Vite + React Router)

アップロード処理のデモ（画面遷移 + 送信中の復帰）を確認するための簡易フロントです。

- Hub -> Epic 画面 -> /processing -> /result
- upload 状態を localStorage に永続化し、リロードしても同じ画面へ復帰します。

ルーティングは `MemoryRouter` を使っているため、ブラウザの URL は基本的に変わりません。

## 事前準備 (初回のみ)
1) Node.js をインストール（推奨: LTS）
2) 依存関係をインストール

```powershell
cd mock-job-demo
npm install
```

## 実行方法 (フロントのみ)
```powershell
npm run dev
```

## 主要ファイル
- ルーター
  - `src/App.tsx`: エントリ + `MemoryRouter` + ルーティング
  - `src/screen/UploadApp.tsx`: ルーター部分のみ（互換/埋め込み用）
  - `src/screen/HubScreen.tsx`: ハブ画面
- 画面
  - `src/screen/cheking-drawings/StartScreen.tsx`: cheking-drawings（画像を2枚1組で送信）
  - `src/screen/label-create/CsvImageUploadScreen.tsx`: label-create（CSV + 画像のペア）
  - `src/screen/utils/ProcessingScreen.tsx`: 進捗表示
  - `src/screen/utils/ResultScreen.tsx`: 結果/再送
- 状態管理 + 永続化
  - `src/screen/utils/UploadContext.tsx`: 状態マシン + localStorage の保存/復元
  - `src/screen/utils/persist.ts`: localStorage から復帰フェーズを共通算出（`derivePhase()`）
- epic init
  - `src/screen/utils/useEpicInit.ts`: epic 画面入場時の init フロー用 Hook
  - `src/ustils/initEpic.ts`: `initEpicSession()` / `endEpicSession()`
- エンドポイント
  - `src/ustils/endpoints.ts`: API パス定義の一元化

## 新しい画面を追加する手順
1) 画面コンポーネントを作成
   - `src/screen/label-create/MyNewScreen.tsx`
   - または `src/screen/cheking-drawings/MyNewScreen.tsx`
2) （任意）`src/screen/Screens.tsx` から再エクスポート
3) ルートを追加
   - `src/App.tsx`（必要なら `src/screen/UploadApp.tsx` にも）
4) ハブへのリンクを追加
   - `src/screen/HubScreen.tsx`

### epic 画面として /epic-init/ を叩きたい場合
- 入場時: `useEpicInit("your-epic")` を利用
  - 内部で `operation="init"` を使用し、`start -> doing` を送信します
- 退出時（ハブに戻るタイミング等）: `await sendEnd()` を呼び、`end` を送信します
- API パスを変更する場合: `src/ustils/endpoints.ts` のみ変更します

## localStorage 永続化
- 有効/無効: `VITE_UPLOAD_PERSIST_STATE=true|false`（デフォルト `true`）
- 保存キー: `upload_state_v1`
- 保存される主な項目:
  - `phase`, `status`（サーバ status: `start|doing|end|error`）
  - `progress`, `completedRequests`, `totalRequests`
  - `failedUploads`, `logs`
  - `operationId`, `lastEpic`, `lastOperation`, `resultData`

### リロード復帰の仕組み
- `UploadContext` は初回マウント時に `upload_state_v1` を hydrate し、状態に応じて `/hub` / `/processing` / `/result` に遷移します。
- ルーター（`src/App.tsx`, `src/screen/UploadApp.tsx`）も `derivePhase()` を使って `initialEntries` とマウント後の復帰遷移を決定します。

### 重要: hydrate 前の上書きを防ぐ
- hydrate 完了前に初期 state（例: idle）で保存が走ると、送信中の状態が消えて復帰できなくなります。
- `UploadContext` は `isHydrated` ガードで、hydrate 完了までは localStorage へ書き込みません。
