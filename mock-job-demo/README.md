# Mock Job Demo (Vite + React Router)

アップロード処理のデモ（画面遷移 + 送信中の復帰）を確認するための簡易フロントです。

- Hub -> Epic 画面 -> /processing -> /result
- upload 状態を localStorage に永続化し、リロードしても同じ画面へ復帰します。

## 環境構築:Node.jsインストール

- Node.js（推奨: LTS）
  https://nodejs.org/ja

##  環境構築:セットアップ

依存関係をインストールします。

```powershell
cd mock-job-demo
npm install
```

## 実行方法

### 開発サーバ（Vite）

  ```powershell
  cd mock-job-demo
  npm run dev
  ```

### （任意）モックAPIサーバ

バックエンド無しで挙動確認したい場合に使います。

  ```powershell
  cd mock-job-demo
  npm run mock:server
  ```

## 主要ファイル
  - ルーター
    - `src/App.tsx`: エントリ。`MemoryRouter` と全ルート定義を持ち、`upload_state_v1` を見て初期表示（`initialEntries`）と復帰遷移（`PersistNavigator`）を決めます。
    - `src/screen/UploadApp.tsx`: ルータ部分だけを切り出した互換/埋め込み用コンポーネント。`App.tsx` と同等のルート構成・復帰判定を持ちます。
    - `src/screen/HubScreen.tsx`: 入口のハブ画面。アップロード種別（`label-create` / `cheking-drawings`）への導線と、画面の説明をまとめます。
  - 画面
    - `src/screen/cheking-drawings/StartScreen.tsx`: 画像アップロード開始画面（2枚=1組）。ファイル選択/ドラッグ&ドロップ→`startUpload()` 呼び出し、（任意）ID発行だけ試すボタンもここにあります。
    - `src/screen/label-create/CsvImageUploadScreen.tsx`: CSV+画像(1:1)のアップロード画面。ペア管理（追加/削除）と、CSV→画像の順に `startUpload(files, { epic, operation })` を呼ぶ入口です。
    - `src/screen/utils/ProcessingScreen.tsx`: 処理中画面。進捗（% / 完了数 / 総数）と `operation_id` を表示し、必要に応じて `useCheckStatusPolling()` を起動します。
    - `src/screen/utils/ResultScreen.tsx`: 結果画面。成功/要再送を表示し、`failedUploads` に基づいて「許可されたファイル名のみ」再送できるUIを提供します（保持済みファイルでの再送もここ）。
  - 状態管理 + 永続化
    - `src/screen/utils/UploadContext.tsx`: アップロードの中心。フェーズ管理（`idle/issuing_id/uploading/verifying/complete/error`）、進捗計算、失敗集約（`failedUploads`）、再送（`isRetry`）まで担当。localStorage（`upload_state_v1`）へ保存/復元（hydrate）もここで行います。
    - `src/screen/utils/persist.ts`: localStorage から「どの画面へ復帰すべきか」を共通算出（`derivePhase()`）。ルータ（`App.tsx` / `UploadApp.tsx`）で使用します。
  - epic init
    - `src/screen/utils/useEpicInit.ts`: epic 画面の入場時 init / 退出時 end 送信用のHook。画面側は `sendEnd()` を呼ぶだけで済むように隠蔽しています。
    - `src/ustils/initEpic.ts`: `initEpicSession()` / `endEpicSession()` の実体。StrictModeの二重実行対策として init をキャッシュし、`operation_id` 発行→`/epic-init/`（doing）送信までをまとめます。
  - エンドポイント
    - `src/ustils/endpoints.ts`: API パス定義の一元化（`/issue/operation-id/`, `/multi-fileupload/`, `/epic-init/`, `/check-status/`）。
  - API/通信
    - `src/sever_demo_api/uploadApi.ts`: フロントから叩くAPI群（`uploadPair` / `completeUpload` / `epicInit` / `checkStatus`）。`VITE_USE_MOCK_API` の切替と、`multipart/form-data`/JSONの切替もここ。
    - `src/ustils/http.ts`: axios インスタンス（`VITE_API_BASE`/timeout等）。
    - `src/screen/utils/useCheckStatusPolling.ts`: `/check-status/` を一定間隔で叩くHook（終了条件: `end/error`）。

## アップロード処理の流れ（コード解説）
アップロード処理は `UploadProvider`（`src/screen/utils/UploadContext.tsx`）に集約しています。

### 1) 入口（画面→startUpload）
- 画像2枚1組のアップロード: `src/screen/cheking-drawings/StartScreen.tsx`
  - `useUpload().startUpload(stagedFiles)` を呼び出します。
- CSV+画像(1:1)のアップロード: `src/screen/label-create/CsvImageUploadScreen.tsx`
  - CSV→画像の順に `files[]` を並べて `startUpload(files, { epic, operation })` を呼び出します。

### 2) Phase 1: operation_id 発行（status=start）
`startUpload()` 内で `phase=issuing_id` に遷移し、ID発行APIを叩きます。

- 呼び出し元: `src/screen/utils/UploadContext.tsx`（`startUpload`）
- ID発行ユーティリティ: `src/ustils/issueOperationId.ts`
  - デフォルトは `VITE_USE_MOCK_API=true` でモックを返します
  - `VITE_USE_MOCK_API=false` の場合は `ENDPOINTS.issueOperation`（`/issue/operation-id/`）へPOSTします

### 3) Phase 2: ファイル送信（status=doing、並列）
`phase=uploading` で、ファイルを「2ファイル=1リクエスト」に分割して並列送信します。

- 分割: `chunkArray(files, 2)`
- 並列実行: `runWithLimit()`（`src/ustils/runWithLimit.ts`）
  - `p-limit` で同時実行数を制限します
  - 同時実行数: `VITE_UPLOAD_CONCURRENCY`（再送時は `VITE_RETRY_UPLOAD_CONCURRENCY`）
- 送信処理: `uploadApi.uploadPair()`（`src/sever_demo_api/uploadApi.ts`）
  - `VITE_USE_MOCK_API=false` の場合は `multipart/form-data` で `ENDPOINTS.fileUpload`（`/multi-fileupload/`）へPOSTします
  - 送信するメタ: `user / epic / operation / operation_id / status / number`

#### label-create のフィールド名（CSV+画像）
`UploadContext` は epic が `label-create` の時だけ、送信フィールドを明示的に切り替えます。

- 実装: `src/screen/utils/UploadContext.tsx`
- `file_field_keys: ['bf_file_csv', 'bf_file']`

### 4) Phase 3: 最終確認（status=end）
全ペアの送信が終わったら `phase=verifying` にして最終確認API（完了通知）を送ります。

- 実装: `src/screen/utils/UploadContext.tsx` → `uploadApi.completeUpload()`
- エンドポイント: `ENDPOINTS.fileUpload`（`/multi-fileupload/`）へ JSON POST

### 5) 結果表示と再送
- 結果画面: `src/screen/utils/ResultScreen.tsx`
- `UploadContext` は送信中の失敗/再送指示を `failedUploads` に集約します
  - その後、結果画面で「許可されたファイル名のみ再送」できるUIを出します

## 設定（環境変数 / Vite）
  Vite の環境変数（`import.meta.env`）で挙動を切り替えています。

  - `VITE_USE_MOCK_API`: モック/実通信の切替（デフォルト `true`）
  - `VITE_API_BASE`: axios の baseURL（`src/ustils/http.ts`）
  - `VITE_UPLOAD_PERSIST_STATE`: localStorage 永続化ON/OFF
  - `VITE_UPLOAD_USER`, `VITE_UPLOAD_EPIC`, `VITE_UPLOAD_OPERATION`: デフォルト値
  - `VITE_UPLOAD_CONCURRENCY`: 通常時の並列数
  - `VITE_RETRY_UPLOAD_CONCURRENCY`: 再送時の並列数
  - `VITE_ENABLE_CHECK_STATUS_POLL`: ステータス確認ポーリングON/OFF
  - `VITE_CHECK_STATUS_POLL_INTERVAL_MS`: ポーリング間隔

## 新しい画面を追加する手順
  1) 画面コンポーネントを作成
    - `src/screen/label-create/MyNewScreen.tsx`
    - または `src/screen/cheking-drawings/MyNewScreen.tsx`
  2) （任意）`src/screen/Screens.tsx` から再エクスポート
  3) ルートを追加
    - `src/App.tsx`（必要なら `src/screen/UploadApp.tsx` にも）
  4) ハブへのリンクを追加
    - `src/screen/HubScreen.tsx`

  ### 1) 画面コンポーネント（テンプレ）

  例: `label-create` 配下に追加する場合（最小）

  ```tsx
  import React from 'react';
  import { Link } from 'react-router-dom';

  export const MyNewScreen: React.FC = () => {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>My New Screen</h1>
          <Link to="/hub">ハブへ戻る</Link>
        </div>
        <p>ここに画面の内容を実装します。</p>
      </div>
    );
  };
  ```

  ※ epic 入場/退出（init/end）を送りたい場合は、下の「epic 画面として /epic-init/ を叩きたい場合」を参照し、既存の `StartScreen.tsx` / `CsvImageUploadScreen.tsx` と同様に `useEpicInit()` を組み込みます。

  ### 2) （任意）Screens.tsx から再エクスポート（テンプレ）

  `src/screen/Screens.tsx` がある場合、他画面と同じように再エクスポートします。

  ```ts
  export { MyNewScreen } from './label-create/MyNewScreen';
  ```

  ### 3) ルート追加（テンプレ）

  `src/App.tsx`（必要なら `src/screen/UploadApp.tsx` にも同じものを追加）

  ```tsx
  import { MyNewScreen } from './screen/label-create/MyNewScreen';

  // ...
  <Routes>
    {/* ... */}
    <Route path="/my-new" element={<MyNewScreen />} />
    {/* ... */}
  </Routes>
  ```

  ### 4) Hub へのリンク追加（テンプレ）

  `src/screen/HubScreen.tsx` にセクションを1つ追加します。

  ```tsx
  import { Link } from 'react-router-dom';

  // ...
  <section
    style={{
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 16,
      display: 'grid',
      gap: 8,
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <h2 style={{ margin: 0 }}>My New Screen</h2>
        <p style={{ margin: '4px 0 0' }}>画面の説明をここに書きます。</p>
      </div>
      <Link className="primary" to="/my-new">開く</Link>
    </div>
  </section>
  ```

## 画面遷移と復帰（ルーティング周り）
 `MemoryRouter` を使用して、ブラウザのURLを基本的に変えずに画面遷移

- ルーティング定義: `src/App.tsx`
- 埋め込み/互換用のルータ: `src/screen/UploadApp.tsx`

### リロード復帰の考え方
- localStorage キー `upload_state_v1` を読み、`derivePhase()` で復帰先を判定
  - 実装: `src/screen/utils/persist.ts`
- ルータ側は
  - `initialEntries`（初期表示）
  - `PersistNavigator`（マウント後の補正遷移）
 で復帰先を合わせます。

## epic init の流れ（入場/退出）
epic 画面として入場時に init、退出時に end を送るための Hook です。
- Hook: `src/screen/utils/useEpicInit.ts`
- 実処理: `src/ustils/initEpic.ts`
  - React 18 StrictMode で effect が2回走るのを避けるため、(user, epic, operation) で init をキャッシュ

## ステータス確認（/check-status）の組み込み方
「処理中」画面表示中に、サーバ側のステータスを定期的に確認するための仕組み

### check-statusの実際に使われている位置
- 呼び出し側: `src/screen/utils/ProcessingScreen.tsx`
  - `useCheckStatusPolling({ operationId, phase, epic, operation })`
- ポーリングHook: `src/screen/utils/useCheckStatusPolling.ts`
- API実装: `src/sever_demo_api/uploadApi.ts` → `uploadApi.checkStatus()`
  - エンドポイント: `ENDPOINTS.checkStatus`（`/check-status/`）

### ポーリングの挙動
- `phase !== 'verifying'` かつ `operationId` がある間、一定間隔で `uploadApi.checkStatus()` を呼ぶ
- `status === 'end' || status === 'error'` が返ったらポーリングを停止
- `useCheckStatusPolling` は epic/operation/user を次の優先度で決めます
  1) 呼び出し引数（`{ epic, operation, user }`）
  2) localStorage（`upload_state_v1` の `lastEpic/lastOperation`）
  3) 環境変数（`VITE_UPLOAD_EPIC` / `VITE_UPLOAD_OPERATION` / `VITE_UPLOAD_USER`）

### check-statusテンプレート（任意の画面に組み込む）
Processing 画面以外でポーリングしたい場合は、操作IDが見えるコンポーネントで Hook を呼びます。

  ```tsx
  import React from 'react';
  import { useUpload } from './utils/UploadContext';
  import { useCheckStatusPolling } from './utils/useCheckStatusPolling';

  export const MyProcessingLikeScreen: React.FC = () => {
    const { operationId, phase, lastEpic, lastOperation } = useUpload();

    useCheckStatusPolling({
      operationId,
      phase,
      epic: lastEpic ?? undefined,
      operation: lastOperation ?? undefined,
    });

    return <div>...</div>;
  };
  ```
### ポーリングのON/OFFと間隔
  - `VITE_ENABLE_CHECK_STATUS_POLL=true|false`（デフォルト `true`）
  - `VITE_CHECK_STATUS_POLL_INTERVAL_MS=2000`（ミリ秒、最小 500ms に丸め）

### モック時の注意
  `VITE_USE_MOCK_API=true` のときでも、`checkStatus` は「可能なら `/check-status/` を叩く」挙動になっています。

  - ローカルでステータス変化を見たい場合は `npm run mock:server` を併用してください
  - 叩けない場合は `doing` を返すフォールバックになります（ポーリング自体は継続）

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

## ビルド/プレビュー（フロント）

### 本番ビルド
```powershell
cd mock-job-demo
npm run build
```
- 出力先は `dist/` です（静的ファイル）。

### ローカルで本番相当の確認
```powershell
npm run preview
```
- `vite preview` が `dist/` を配信します。



