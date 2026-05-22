
## システム概要

AI を活用した図面確認システムのバックエンド。図面（PDF・画像）をアップロードし、Google Cloud Vision API による OCR と Vertex AI / Gemini による AI 推論を組み合わせて以下の機能を提供する。

| 機能 | 内容 |
|---|---|
| ラベル作成（`label_create`） | 図面からラベル情報を自動生成 |
| 図面レビュー（`drawing_review`） | 図面の内容を AI でレビュー |
| 図面比較（`drawing_compare`） | 2枚の図面を比較して差分を検出 |
| 図面ハイライト（`drawing_highlight`） | 図面上の注目箇所をハイライト |

## 技術スタック

### バックエンド (BE)

| カテゴリ | 技術 |
|----------|------|
| 言語 | Python 3.12 |
| Webフレームワーク | FastAPI + Uvicorn |
| AI推論 | Google Vertex AI (`vertexai`) / Gemini (`google-genai`) |
| OCR | Google Cloud Vision API |
| 画像処理 | OpenCV, Pillow, imagehash |
| PDF処理 | pdf2image, img2pdf, pikepdf |
| データ処理 | Polars, openpyxl |
| セッション | itsdangerous (Starlette SessionMiddleware) |
| 非同期処理 | asyncio（サブプロセスでAI処理を別実行） |
| ステータスキャッシュ | Azure Cache for Redis（redis-py） |

### フロントエンド (FE)

| カテゴリ | 技術 |
|----------|------|
| 言語 | TypeScript |
| UIフレームワーク | React 18 |
| ビルドツール | Vite |
| ルーティング | React Router (MemoryRouter) |
| HTTPクライアント | Axios |

## コマンド

### バックエンド起動
```powershell
# 仮想環境をアクティベートしてから起動
.\.venv\Scripts\activate
python test_app.py DEV    # 開発環境
python test_app.py PROD   # 本番環境
```

### フロントエンド起動
```powershell
cd mock-job-demo
npm run dev
```

### Python依存関係インストール（プロキシ必須）
```powershell
.\.venv\Scripts\pip install -r requirements.txt --proxy http://zproxy.ns-sol.co.jp:8000
```

### フロントエンド依存関係インストール
```powershell
cd mock-job-demo
npm install
```

## アーキテクチャ概要

### バックエンド（FastAPI / Python）

**起動フロー**  
`test_app.py` → `AppServer.__init__()` が以下を順番にセットアップ：
1. `AppConfig` — `conf/conf_dev.json` or `conf_prod.json` を読み込む
2. `AppLogger` / `BatchLogger` — 2本のログ（`logs/app_main.log`、`logs/app_batch.log`）
3. CORS ミドルウェア + `AppMiddleware`
4. `AppState` — 共有状態オブジェクト
5. `Manager` 群 (`SessionManager`, `AppStatusManager`)
6. ルーター群 (`router/` ディレクトリ)
7. `BackendTasks` — 重い処理用のサブプロセス管理

**リクエスト処理の流れ**

```
HTTPリクエスト
  → AppMiddleware: form/JSON を解析して request.state に展開
  → Managers.start_managers():
      - SessionManager: セッション有効期限チェック
      - AppStatusManager: ステータス遷移の妥当性検証 + 期限切れエントリ削除
  → AppRoute（カスタム APIRoute）: ログ記録
  → 各ルーター関数
```

**AppStatus — コアデータモデル**  
`state/app_status.py` の `AppStatus` は全操作の識別子。  
ハッシュキー = `{user}_{epic}_{operation}_{operation_id}`  
ステータス遷移は一方向のみ（`START=0 → DOING=1 → END=2`、逆行は `AppStatusManager` が 401 で拒否）。  
エラー時は `ERROR=-1`。

**ステータス管理（Redis）**  
操作ごとのステータスは Azure Cache for Redis に保存する（プロセス再起動後も維持・スケールアウト対応）。  
`AppState` に Redis クライアントを保持し、`state_func/` 以下の各モジュールが読み書きする。  
TTL は `conf_*.json` の `APP_STATUS.expire`（秒）を使用し、Redis が期限切れキーを自動削除する。

| state_func モジュール | Redis キープレフィックス | 保存データ |
|---|---|---|
| `app_status_func.py` | `app_status:` | AppStatus（操作ステータス） |
| `multi_fileupload_func.py` | `multi_file_upload:` | MultiFileUploadInfo（アップロード情報） |
| `boot_another_process_func.py` | `boot_another_process:` | BaseBootAnotherProcessInfo（サブプロセス状態） |
| `drawing_highlight_func.py` | `drawing_highlight:` | DrawingHighlightInfo |
| `image_similarity_func.py` | `image_similarity:` | ImageSimilarityInfo |

**重い処理（AI推論）の実行パターン**  
各ルーターの `BackendTaskRunner` サブクラスが `get_cmd()` でコマンドを組み立て、  
`BackendTasks.set_backend_runner()` が `asyncio.create_subprocess_exec` 経由でシェルスクリプトを非同期サブプロセスとして起動する。  
タスクキーは `{epic}_{operation}` で、`conf_*.json:BACKEND_TASKS` にシェルコマンドが対応付けられている。

**AppState の動的メソッド注入**  
`AppState` は `state_func/` 以下のモジュール内の関数を `MethodType` で自身に動的にバインドする。  
新しい状態操作を追加する場合は `state_func/` にモジュールを追加し、`AppState.get_members()` に追記する。

**ファイル格納パターン**
- アップロードファイル: `multi-fileupload/{hash_key}/`
- 処理結果: `{feature}-responce/{hash_key}/`（例: `create-label-responce/`, `drawing-compare-responce/`）

### フロントエンド（React / TypeScript / Vite）

**ルーティング**  
`MemoryRouter` を使用（ブラウザURLを自動追従しない）。  
初回アクセス時は URL パスを優先し、なければ `/hub` へ遷移。  
`mock-job-demo/src/routers/Router.tsx` が全ルートを定義。

**機能ディレクトリ構成**  
`src/features/` 以下に機能単位でディレクトリが分かれており、各機能は以下の画面遷移パターンを踏む：
1. アップロード画面（ファイル選択・送信）
2. 処理中画面（ポーリング）
3. 結果画面（ダウンロード or 表示）

機能一覧: `label_create`、`drawing_review`、`drawing_compare`、`drawing_highlight`

**API層**  
`src/api/` 以下に機能別ファイル。`http.ts` が axios インスタンス（ベース URL は `VITE_API_BASE`、デフォルト空）。  
`VITE_USE_MOCK_API=false` のときは実バックエンドに接続する（`vite.config.ts` の `/api` プロキシ → `http://localhost:8000`）。

**ポーリング**  
処理中画面では `src/hooks/usePolling.ts` の `usePolling` フックが `/api/check-status/` を定期的に叩く。  
`stopEnd`（`status === 'end'`）か `stopError`（`status === 'error'`）になるまで継続。  
デフォルト間隔は 3 秒、`.env.local` の `VITE_CHECK_STATUS_POLL_INTERVAL_MS` で変更可能。

**操作ID の払い出し**  
全操作は開始前に `/api/issue/operation-id/` か `/api/epic-init/` を呼んで `operation_id` を取得する。  
以降のリクエストはすべて `{user, epic, operation, operation_id, status}` を含める。

## 設定ファイル

- `conf/conf_dev.json` / `conf/conf_prod.json` — ログ設定、ステータス有効期限（秒）、バックエンドタスクのコマンドマッピング、Redis 接続情報（`REDIS.host/port/password/ssl`）
- `mock-job-demo/.env.local` — フロントエンドの環境変数（`VITE_USE_MOCK_API`, `VITE_API_BASE` など）
- `mab-ai-check-drawing-sa-key.json` — Google Cloud サービスアカウントキー（ディレクトリ直下に配置必須）

## ログ

- `logs/app_main.log` — API サーバーのメインログ（エンコーディング: shift_jis）
- `logs/app_batch.log` — バックエンドタスク（AI処理）のログ（エンコーディング: utf-8）
