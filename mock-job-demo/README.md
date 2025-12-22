# Mock Job Demo (Vite + React Router)

簡易モック環境。`react-router-dom` を使ってジョブ開始→進捗ポーリング→結果表示までを再現します。

## 事前準備 (初回のみ)
1. Node.js をインストール
   - 推奨: LTS (v18 以上) を <https://nodejs.org> から取得
   - インストール後、PowerShell で `node -v` / `npm -v` を確認

2. 依存関係をインストール
   ```powershell
   cd mock-job-demo
   npm install
   ```

## 実行方法 (フロントのみ)
```powershell
npm run dev
```
表示されたローカル URL をブラウザで開いてください。

## 構成メモ
- ルート/設定
   - `package.json`: スクリプトと依存。`dev`/`build`/`preview`/`mock:server`。
   - `vite.config.ts`: React プラグインと `/issue` `/upload` を 127.0.0.1:8000 へプロキシ。
   - `.env.local` (任意): `VITE_USE_MOCK_API`, `VITE_API_BASE`, `VITE_UPLOAD_USER/EPIC/OPERATION`, `VITE_UPLOAD_CONCURRENCY`, `VITE_RETRY_UPLOAD_CONCURRENCY`。
- エントリ/スタイル
   - `index.html`: `#root` マウントポイント。
   - `src/index.css`: シンプルな全体スタイル。
- 画面と状態管理
   - `src/App.tsx` / `src/screen/UploadApp.tsx`: ルーター。`/` → `/processing` → `/result`。
   - `src/screen/StartScreen.tsx`: 画像ステージングとアップロード開始、ID 発行テストボタン。
   - `src/screen/ProcessingScreen.tsx`: 進捗バーと件数表示。
   - `src/screen/ResultScreen.tsx`: 再送指示表示、指定ファイルのみ再送、保持済みファイル再送ボタン。
   - `src/screen/UploadContext.tsx`: ID 発行→並列アップロード→完了通知。失敗保持、再送時は低コンカレンシー。
   - `src/screen/Screens.tsx`: 画面の再エクスポート（互換用）。
- API/ユーティリティ
   - `src/sever_demo_api/uploadApi.ts`: 実送信用 API。`VITE_USE_MOCK_API` でモック/実サーバー切替。
   - `src/sever_demo_api/mockApi.ts`: 10 秒で進捗 0→100% を模擬するジョブ API デモ。
   - `src/ustils/http.ts`: axios インスタンス (baseURL は `VITE_API_BASE`)。
   - `src/ustils/issueOperationId.ts`: ID 発行 API 呼び出し (モック対応)。
   - `src/ustils/runWithLimit.ts`: 並列数制御付き実行ヘルパー。
- 型定義
   - `src/types/upload.ts` / `uploadServer.ts` / `uploadClient.ts`: リクエスト・レスポンス・クライアント状態の型。
- モックサーバー (Node)
   - `sever_demo_api/mockServer.js`: Express+multer。`/issue/operation_id/` と `/upload/` を提供。`npm run mock:server` でポート 8000 起動。
- 主要スクリプト
   - `npm run dev`: 開発サーバー起動。
   - `npm run build`: 本番ビルド。
   - `npm run preview`: ビルド結果をローカルで確認。
   - `npm run mock:server`: モックサーバー起動 (ポート 8000)。

## 新しい画面を追加する手順 (フロント)
1. 画面の配置先を決める
   - `/label-create` 系: `src/screen/label-create/`
   - `/cheking-drawings` 系: `src/screen/cheking-drawings/`
   - 共通部品: `src/screen/utils/`

2. コンポーネントを作成
   - 例: `src/screen/label-create/MyNewScreen.tsx`
   - アップロード状態が必要なら `import { useUpload } from '../utils/UploadContext'`

3. 再エクスポートを追加
   - `src/screen/Screens.tsx` に `export { MyNewScreen } from './label-create/MyNewScreen';` のように追記

4. ルーティングを追加
   - `src/App.tsx` と `src/screen/UploadApp.tsx` に `<Route path="/my-path" element={<MyNewScreen />} />` を追加
   - デフォルト遷移先は `/hub`。必要なら `HubScreen` からリンクを追加

5. ナビゲーションを更新
   - `src/screen/HubScreen.tsx` にリンクカードを追加して行き先を案内

6. 動作確認
   - `npm run dev` を実行し、追加したパスにブラウザでアクセスして確認

### ステータスごとに画面を切り替える場合
`UploadContext` が `phase` で状態を持っています (`idle` | `issuing_id` | `uploading` | `verifying` | `complete` | `error`)。

例: 進捗画面をカスタムしたい場合
```tsx
import { useUpload } from './screen/utils/UploadContext';

export const MyProcessing: React.FC = () => {
   const { phase, progress, completedRequests, totalRequests, logs } = useUpload();
   if (phase === 'error') return <div>エラー: {logs.at(-1)}</div>;
   return (
      <div>
         <h2>状態: {phase}</h2>
         <div>{progress}% ({completedRequests}/{totalRequests})</div>
      </div>
   );
};
```

ルーターで差し替える
```tsx
// App.tsx / UploadApp.tsx の Routes に追加/置き換え
<Route path="/processing" element={<MyProcessing />} />
```

結果画面を変えたい場合も同様に、`useUpload` で `resultData` / `failedUploads` / `operationId` を取得してコンポーネントを作り、ルートを差し替えます。

