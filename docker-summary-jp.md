# まとめ: FastAPI と Batch サーバーを 2 つの Docker コンテナに分離

本ドキュメントは、**1 プロセスで動くモノリス構成**から **Redis Streams で通信する 2 コンテナ構成**へリファクタリングした内容のまとめです。

---

## 1. 目的

- `backend_tasks/` を独立したサービス(バッチワーカー)として分離し、FastAPI とは別コンテナで起動する。
- FastAPI ↔ Batch 間の通信は **Redis Streams + Consumer Group** を使用(永続キュー、ACK 対応、複数ワーカーへのスケール可能)。
- 入出力ファイルは **Docker named volume** (`shared_data`) で共有。
- ステータス管理は既存どおり Redis を使用。

---

## 2. アーキテクチャ Before / After

### Before
```
[FastAPI process]
  ├─ Router (status=START)
  │    └─ BackendTasks.set_backend_runner()
  │          └─ fastapi.BackgroundTasks.add_task()
  │                └─ asyncio.create_subprocess_exec("bash ./shell/xxx.sh ...")
  │                      └─ python ./backend_tasks/xxx_task.py --arg1 ... (子プロセス)
  └─ (同一プロセス内で Redis status を更新)
```
→ FastAPI とバッチ処理は **同じプロセス上で実行**、ローカルファイルシステムを共有。

### After
```
[Container: api]                      [Container: batch]
  FastAPI router                        worker.py (XREADGROUP loop)
    └─ BackendTasks.publish()             └─ TASK_REGISTRY[task_type](params)
          │                                     │
          │  XADD jobs:batch                    │  Redis status を更新
          ▼                                     ▼
       [Container: redis] ◄────────────── XACK ◄┘
         · Stream "jobs:batch"
         · Consumer Group "batch-workers"
         · Status keys "app_status:*"

  [Volume: shared_data]  ◄── 両コンテナにマウント
```
→ 2 つのコンテナは完全に独立し、通信は **Redis と共有ボリュームのみ**。

---

## 3. 新しいディレクトリ構成

```
mab-ai-check-drawing-back/
├── docker-compose.yml                  ← オーケストレーション
├── .dockerignore
│
├── common/                             ← 2 サービス共通コード
│   ├── config.py                       ← conf JSON 読込 + 環境変数オーバーライド
│   ├── logger.py                       ← AppLogger / BatchLogger
│   ├── redis_client.py                 ← Redis クライアントファクトリ
│   ├── app_state.py                    ← AppState (state_func メソッドを bind)
│   ├── state/                          ← AppStatus, FileInfo, ...
│   ├── state_func/                     ← Redis ベースの CRUD 関数群
│   ├── tools/                          ← sort_manga_panels
│   └── queue/                          ← 新規: Redis Streams 抽象化
│       ├── job_schema.py               ← Job dataclass
│       ├── job_publisher.py            ← XADD ラッパー
│       └── job_consumer.py             ← XREADGROUP + pending リカバリ
│
├── api_server/                         ← FastAPI コンテナ
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                         ← エントリーポイント (uvicorn)
│   ├── app_server.py
│   ├── app_router.py
│   ├── app_manager.py
│   ├── app_backend_task.py             ← ジョブ発行 (subprocess は廃止)
│   ├── conf/                           ← conf_dev.json + uvicorn log 設定
│   ├── manager/                        ← session_manager, app_status_manager
│   ├── router/                         ← API エンドポイント
│   └── lib/
│       └── image_similarity_utils.py   ← test_scripts/test_similarity_image.py から移動
│
└── batch_server/                       ← Batch ワーカーコンテナ
    ├── Dockerfile
    ├── requirements.txt
    ├── worker.py                       ← XREADGROUP ループ + ディスパッチ + ACK
    ├── conf/                           ← conf_dev.json
    └── tasks/                          ← backend_tasks/ から移動
        ├── create_label_task.py
        ├── update_label_task.py
        ├── drawing_review_task.py
        ├── drawing_compare_task.py
        └── utils/                      ← gemini_response, vision_ocr, ...
```

---

## 4. 新規作成したファイル (目的付き)

### 4.1. キューモジュール (完全新規)

| ファイル | 目的 |
|---|---|
| [common/queue/job_schema.py](common/queue/job_schema.py) | FastAPI ↔ Batch 間で受け渡す `Job` dataclass。Redis Streams は flat な文字列 map のみ受付けるため、`to_stream_fields()` / `from_stream_fields()` で serialize/deserialize を行う(`params` は JSON エンコード)。 |
| [common/queue/job_publisher.py](common/queue/job_publisher.py) | `JobPublisher` クラス — FastAPI ルーターがジョブを stream に投入するための `XADD` ラッパー。 |
| [common/queue/job_consumer.py](common/queue/job_consumer.py) | `JobConsumer` クラス — `XREADGROUP` (BLOCK 付き) のラッパー。ワーカー起動時に **自分の pending リストを先に drain** し、クラッシュ途中のジョブをリカバリ。その後新規ジョブの読み取りループへ。`XGROUP CREATE` も冪等に実行。 |

### 4.2. コンテナインフラ (完全新規)

| ファイル | 目的 |
|---|---|
| [docker-compose.yml](docker-compose.yml) | 3 サービスを定義: `redis` (port 6380→6379)、`api` (port 8100→8000)、`batch`。`api` と `batch` は同じ named volume `shared_data` をマウントしてファイル共有。`depends_on` で Redis のヘルスチェック待機。 |
| [.dockerignore](.dockerignore) | `.git`、`__pycache__`、ランタイムデータ、フロントエンド、テストスクリプトを除外。イメージの軽量化と漏洩防止。 |
| [api_server/Dockerfile](api_server/Dockerfile) | Base: `python:3.12-slim` + `poppler-utils` (pdf2image)、`libgl1`/`libglib2.0-0` (opencv)。`DATA_ROOT=/app/shared_data`、`APP_LOG_FILE`、`BATCH_LOG_FILE` をセットし、ログをボリュームへ。 |
| [batch_server/Dockerfile](batch_server/Dockerfile) | 同様の内容に加えて `mab-ai-check-drawing-sa-key.json` を COPY し、`GOOGLE_APPLICATION_CREDENTIALS` を設定 (Gemini / Vision API 用)。 |
| [api_server/requirements.txt](api_server/requirements.txt) | API 側に必要な依存のサブセット (fastapi, uvicorn, pdf2image, img2pdf, opencv-python, imagehash, redis …)。 |
| [batch_server/requirements.txt](batch_server/requirements.txt) | バッチ側に必要な依存のサブセット (google-genai, google-cloud-vision, openpyxl, opencv-python …)。 |

### 4.3. Common モジュール (既存コードから再構成)

| ファイル | 目的 |
|---|---|
| [common/config.py](common/config.py) | `app_config.py` からのリファクタ。追加点: `QUEUE` セクション(stream/group/block_ms)、`data_root` プロパティ、各フィールドを環境変数でオーバーライド可能 (`REDIS_HOST`、`DATA_ROOT`、`APP_LOG_FILE` …)。 |
| [common/logger.py](common/logger.py) | `app_logger.py` からのリファクタ。`os.makedirs(log_dir, exist_ok=True)` を追加してログディレクトリが自動生成されるように。 |
| [common/redis_client.py](common/redis_client.py) | `AppConfig` から `redis.Redis` インスタンスを生成するファクトリ。 |
| [common/app_state.py](common/app_state.py) | `app_state.py` からのリファクタ。`app_state` 引数を Optional 化 (FastAPI 側は `request.state`、バッチ側は `None`)。 |

### 4.4. 各コンテナのエントリーポイント

| ファイル | 目的 |
|---|---|
| [api_server/main.py](api_server/main.py) | 旧 `test_app.py` の置き換え。環境変数 `RUN_ENV`、`API_HOST`、`API_PORT` を読み込み。デフォルトホストは `0.0.0.0` (コンテナ外公開のため)。 |
| [batch_server/worker.py](batch_server/worker.py) | **完全新規**。メインループ: `XREADGROUP` → Redis ステータス `DOING` 更新 → `TASK_REGISTRY[task_type](params)` 実行 → `END`/`ERROR` 更新 → `XACK`。`KeyboardInterrupt` ハンドラでクリーンシャットダウン。 |

### 4.5. App backend task のリファクタ

| ファイル | 目的 |
|---|---|
| [api_server/app_backend_task.py](api_server/app_backend_task.py) | 旧 `app_backend_task.py` の **完全リファクタ**。subprocess を起動していた `BackendTaskRunner.start()` を撤廃。現在は `BackendTasks.publish(req_status, runner)` のみ → `Job` 生成 → `XADD`。各 Runner は `get_cmd()` (CLI 文字列) ではなく `get_params()` (dict 返却) を override する。 |

---

## 5. Docker 配下に移動したファイル

### 5.1. `common/` への移動 (両コンテナで共有)

| 元の場所 | 移動先 | 備考 |
|---|---|---|
| `state/*.py` | [common/state/](common/state/) | AppStatus, FileInfo など |
| `state_func/*.py` | [common/state_func/](common/state_func/) | `from state.X` → `from common.state.X` に修正 |
| `tools/sort_manga_panels.py` | [common/tools/sort_manga_panels.py](common/tools/sort_manga_panels.py) | |

### 5.2. `api_server/` への移動

| 元の場所 | 移動先 | 備考 |
|---|---|---|
| `app_router.py` | [api_server/app_router.py](api_server/app_router.py) | import パス修正 |
| `app_manager.py` | [api_server/app_manager.py](api_server/app_manager.py) | import パス修正 |
| `app_server.py` | [api_server/app_server.py](api_server/app_server.py) | リファクタ: `common.*` を使用、デフォルトホスト `0.0.0.0` |
| `manager/*.py` | [api_server/manager/](api_server/manager/) | import パス修正 |
| `router/*.py` | [api_server/router/](api_server/router/) | import パス修正 + `DATA_ROOT` 環境変数を適用 |
| `conf/*.json + uvicorn_log_*.py` | [api_server/conf/](api_server/conf/) | `QUEUE` セクション追加、`BACKEND_TASKS` 削除、ログディレクトリ修正 |
| `test_scripts/test_similarity_image.py` | [api_server/lib/image_similarity_utils.py](api_server/lib/image_similarity_utils.py) | リネーム (誤解を招く `test_` プレフィクスを削除) |

**リファクタしたルーター (subprocess 起動 → ジョブ発行):**
- [api_server/router/create_label.py](api_server/router/create_label.py)
- [api_server/router/drawing_review.py](api_server/router/drawing_review.py)
- [api_server/router/drawing_compare.py](api_server/router/drawing_compare.py)
- [api_server/router/update_label.py](api_server/router/update_label.py) — **インラインロジック (annotate + PDF + CSV) をバッチタスク側に分離**。

### 5.3. `batch_server/` への移動

| 元の場所 | 移動先 | 備考 |
|---|---|---|
| `backend_tasks/create_label_task.py` | [batch_server/tasks/create_label_task.py](batch_server/tasks/create_label_task.py) | ワーカー呼出し用の `run(params)` 関数を追加 |
| `backend_tasks/drawing_review_task.py` | [batch_server/tasks/drawing_review_task.py](batch_server/tasks/drawing_review_task.py) | `__main__` を `_run_review()` + `run(params)` に分離 |
| `backend_tasks/drawing_compare_task.py` | [batch_server/tasks/drawing_compare_task.py](batch_server/tasks/drawing_compare_task.py) | `__main__` を `_run_compare()` + `run(params)` に分離 |
| `backend_tasks/update_label_task.py` | [batch_server/tasks/update_label_task.py](batch_server/tasks/update_label_task.py) | **元は空のスケルトン** — annotate ロジック (旧 `update_label.py` ルーターから) を実装 |
| `backend_tasks/utils/*.py` | [batch_server/tasks/utils/](batch_server/tasks/utils/) | import パス修正 |
| `conf/*.json` | [batch_server/conf/](batch_server/conf/) | api_server と同内容 |

---

## 6. 削除したファイル

**理由:** Docker 配下に移動済みのため、不要となった。

| 削除されたファイル | 代替先 |
|---|---|
| `app_backend_task.py` | `api_server/app_backend_task.py` |
| `app_config.py` | `common/config.py` |
| `app_logger.py` | `common/logger.py` |
| `app_manager.py` | `api_server/app_manager.py` |
| `app_router.py` | `api_server/app_router.py` |
| `app_server.py` | `api_server/app_server.py` |
| `app_state.py` | `common/app_state.py` |
| `test_app.py` | `api_server/main.py` |
| `requirements.txt` (root) | `api_server/requirements.txt` + `batch_server/requirements.txt` |
| `manager/` | `api_server/manager/` |
| `router/` | `api_server/router/` |
| `state/` | `common/state/` |
| `state_func/` | `common/state_func/` |
| `tools/` | `common/tools/` |
| `conf/` | `api_server/conf/` + `batch_server/conf/` |
| `shell/` | **完全廃止** — subprocess 起動フローは Redis キューに置き換え |
| `backend_tasks/{create_label,drawing_compare,drawing_review,update_label}_task.py` | `batch_server/tasks/*.py` |
| `backend_tasks/utils/` | `batch_server/tasks/utils/` |
| `test_scripts/test_similarity_image.py` | `api_server/lib/image_similarity_utils.py` |

---

## 7. 変更せず残したファイル

| ファイル / フォルダ | 残した理由 |
|---|---|
| `README.md` | 元のセットアップ手順。参考価値あり (要更新)。 |
| `.gitignore` | 引き続き有効 |
| `test_client.py` | API を手動テストするためのクライアント。動作中コンテナの確認に有用。 |
| `mock-job-demo/` | フロントエンド (React/TS) — バックエンドリファクタの対象外。 |
| `mab-ai-check-drawing-sa-key.json` | GCP サービスアカウントキー — batch_server の Dockerfile が COPY する。 |
| `backend_tasks/box_take_out.py` | デバッグスクリプト — メインワークフローには含まれず、未移行。 |
| `backend_tasks/test_*.py` (7 ファイル) | スタンドアロンのデバッグ / テストスクリプト — Docker 内には含めない。 |
| `test_scripts/test_get_image_rect.py` | デバッグスクリプト |
| `test_scripts/test_image_cut.py` | デバッグスクリプト |
| `logs/`、`multi-fileupload/`、`*-responce/`、`update-label-response/` | Docker 外でのローカル開発用のランタイムデータ。コンテナ内では `shared_data` ボリュームを使うので影響なし。ローカル開発不要なら削除可能。 |

---

## 8. ビルドと起動方法

```bash
# 2 つのイメージをビルド
docker compose build

# 起動
docker compose up

# バッチワーカーをスケール
docker compose up --scale batch=3

# ログ確認
docker compose logs -f api
docker compose logs -f batch
```

**ポートマッピング:**
- API: `localhost:8100` → コンテナ `:8000`
- Redis: `localhost:6380` → コンテナ `:6379`

---

## 9. リクエストの完全な流れ (例: create-label)

1. **クライアント** → `POST /api/create-label/` (status=`start`)
2. **API コンテナ**:
   - ルーター `create_label.py` がリクエスト受領
   - `shared_data/multi-fileupload/{hash_key}/` で PDF → JPEG 変換 (必要時)
   - `BackendTasks.publish()` → `XADD jobs:batch * task_type=create-label user=... params={...}`
   - レスポンス返却 (クライアントはジョブ受領を確認)
3. **Batch コンテナ**:
   - `worker.py` が `XREADGROUP` ブロック中 → メッセージ受領
   - Redis ステータス更新 → `DOING`
   - `create_label_task.run(params)` 実行 (OCR + Gemini 処理 → 結果を `shared_data/create-label-responce/{hash_key}/` に書き出し)
   - 完了時 → Redis ステータス更新 → `END`
   - メッセージを `XACK`
4. **クライアント** が `POST /api/check-status/` を定期ポーリング → Redis ステータスを読取
5. ステータスが `end` になったら → **クライアント** が `POST /api/create-label/` (status=`end`) を呼出 → API が結果を zip にして返却

---

## 10. 注意点 / TODO

- **At-least-once delivery**: Redis Streams はワーカーが `XACK` 前にクラッシュするとジョブを再配信する可能性あり。現在のタスクは `hash_key` ベースで冪等 (同じキー → ファイル上書き)。新規タスク追加時は冪等性を保証すること。
- **Pending リストリカバリ**: ワーカーは起動時に自分の pending を自動 drain。他コンシューマーからのジョブ奪取 (sticky failure) が必要な場合は `XAUTOCLAIM` を使うが、未実装。
- **ログファイルローテーション**: 複数バッチワーカーが同一ファイルに書込むと競合の可能性あり。現在は `logs/api/` と `logs/batch/` を分離済みだが、バッチワーカーを大量にスケールする場合は stdout 経由のログ出力 (Docker ログドライバ任せ) を検討すべき。
- **サービスアカウントキー**: 現状はバッチイメージに COPY しているが、本番では Docker secret やマウントを使うべき。
- **conf JSON** にはデフォルト `./logs/app_*.log` が残っているが、Dockerfile 内で `APP_LOG_FILE` / `BATCH_LOG_FILE` 環境変数で上書きされるので問題なし。
- **`drawing_highlight` と `image_similarity` ルーター**: 引き続き FastAPI プロセス内で同期処理 (キュー経由ではない) — 合意済みのスコープ通り。今後パフォーマンスが問題になればキュー化を検討。
