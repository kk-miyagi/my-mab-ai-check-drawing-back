# mab-ai-check-drawing-back

## 🚀技術スタック

| 分類 | 技術 |
| --- | --- |
| フロントエンド | React, TypeScript, Vite |
| バックエンド | Python, FastAPI |
| バッチワーカー | Python (Redis Streams コンシューマー) |
| メッセージング / ステート | Redis (Streams + Key-Value) |
| コンテナ | Docker, Docker Compose |
| API クライアント | Axios |
| パッケージマネージャー | npm(フロントエンド), pip(バックエンド) |

## 📁ディレクトリ構造
```
mab-ai-check-drawing-back
├─ api_server/              ← FastAPI コンテナ
│  ├─ Dockerfile
│  ├─ main.py               ← エントリーポイント (uvicorn)
│  ├─ requirements.txt
│  ├─ conf/
│  ├─ manager/
│  ├─ router/
│  └─ lib/
├─ batch_server/            ← バッチワーカーコンテナ
│  ├─ Dockerfile
│  ├─ worker.py             ← Redis Streams コンシューマー
│  ├─ requirements.txt
│  ├─ conf/
│  └─ tasks/
├─ common/                  ← 2 サービス共通コード
│  ├─ config.py
│  ├─ logger.py
│  ├─ redis_client.py
│  ├─ state/
│  ├─ state_func/
│  └─ queue/
├─ mock-job-demo/           ← フロントエンド (React/TS)
├─ docker-compose.yml
├─ .dockerignore
└─ README.md
```

## 🐳 Docker で動かす(推奨)

バックエンド(FastAPI + バッチワーカー + Redis)はすべて Docker コンテナで起動できます。**poppler / Python / Redis を手動でインストールする必要はありません** — Dockerfile 内で自動セットアップされます。

### 前提条件
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS) または Docker Engine + Docker Compose (Linux)
- フロントエンドを動かす場合のみ Node.js LTS

### 手順

1. リポジトリのクローン
    ```bash
    git clone https://tetralink-gitlab-prj-mab-ai-adv-util.apps.tetra-c2.sdc.ns-sol.co.jp/mab-ai-adv-util/mab-ai-check-drawing-back.git
    cd mab-ai-check-drawing-back
    ```

2. 認証情報ファイルの配置

    [こちら](https://nssolgrp.sharepoint.com/:f:/r/sites/ind-AIPoC/Shared%20Documents/10.%E9%96%8B%E7%99%BA%E3%83%81%E3%83%BC%E3%83%A0/%E9%96%8B%E7%99%BA/%E6%A4%9C%E5%9B%B3/%E8%AA%8D%E8%A8%BC%E6%83%85%E5%A0%B1?csf=1&web=1&e=r1YKYm) から GCP サービスアカウントキー (`mab-ai-check-drawing-sa-key.json`) をダウンロードし、リポジトリ直下に配置してください。`batch_server/Dockerfile` がビルド時にコピーします。

3. イメージのビルドと起動
    ```bash
    docker compose up --build
    ```

    起動するサービス:
    - `mab-redis` — Redis 7 (ホスト `localhost:6380`)
    - `mab-api`   — FastAPI (ホスト `localhost:8100`)
    - `mab-batch` — バッチワーカー(Redis Streams を購読)

4. バッチワーカーのスケール(任意)
    ```bash
    docker compose up --scale batch=3
    ```

5. フロントエンドの起動(別シェル)
    ```bash
    cd mock-job-demo
    npm install
    npm run dev
    ```

### ログ確認
```bash
docker compose logs -f api
docker compose logs -f batch
```

### 停止
```bash
docker compose down            # コンテナのみ削除
docker compose down -v         # ボリューム(shared_data, redis_data)も削除
```

---

## 🛠️ ローカル環境セットアップ(Docker を使わない場合)

Docker を使わず直接ホスト上で動かす場合の手順です。

1. Gitのインストール
    ```bash
    winget install --id Git.Git -e --source winget
    ```

2. Pythonのインストール
    ```bash
    winget install -e --id Python.Python.3.12
    ```

3. Node.jsのインストール
    ```bash
    winget install -e --id OpenJS.NodeJS.LTS
    ```

4. popplerのインストール(`pdf2image` が利用するネイティブツール)
    1. [こちら](https://github.com/oschwartz10612/poppler-windows/releases/)から最新のパッケージをダウンロード
    2. 展開して`C:\Program Files (x86)`へ移動
    3. パスを通す
        - システム環境変数の編集 > 環境変数 > システム環境変数のPathをクリック
        - 新規「C:\Program Files (x86)\poppler-25.12.0\Library\bin\」で保存
            - バージョンはインストールしたものに合わせて変更してください。

5. Redis の起動

    バッチワーカーとの通信、およびステータス管理に Redis が必要です。最も簡単な方法は Docker でのみ Redis を起動すること:
    ```bash
    docker compose up redis
    ```

6. リポジトリのクローン
    ```bash
    git clone https://tetralink-gitlab-prj-mab-ai-adv-util.apps.tetra-c2.sdc.ns-sol.co.jp/mab-ai-adv-util/mab-ai-check-drawing-back.git
    cd mab-ai-check-drawing-back
    ```

7. 依存関係のインストール

    **フロントエンド**
    ```bash
    cd mock-job-demo
    npm install
    ```

    **バックエンド** (API サーバー + バッチワーカー両方の依存をインストール)
    ```bash
    python -m venv .venv
    .\.venv\Scripts\activate

    pip install -r api_server/requirements.txt
    pip install -r batch_server/requirements.txt
    ```

8. 認証情報ファイルの配置

    [こちら](https://nssolgrp.sharepoint.com/:f:/r/sites/ind-AIPoC/Shared%20Documents/10.%E9%96%8B%E7%99%BA%E3%83%81%E3%83%BC%E3%83%A0/%E9%96%8B%E7%99%BA/%E6%A4%9C%E5%9B%B3/%E8%AA%8D%E8%A8%BC%E6%83%85%E5%A0%B1?csf=1&web=1&e=r1YKYm)から認証情報ファイル (`mab-ai-check-drawing-sa-key.json`) をダウンロードして、ディレクトリ直下に配置してください。

## 🏃実行方法(ローカル環境)

> Docker を使う場合は `docker compose up` だけで API・バッチワーカー・Redis がすべて起動します。以下はローカル環境でのみ必要です。

Redis が起動済みであることを確認した上で、3 つのターミナルでそれぞれ起動します。

1. API サーバーの起動
    ```bash
    .\.venv\Scripts\activate
    set RUN_ENV=DEV
    set REDIS_HOST=localhost
    set REDIS_PORT=6380
    python -m api_server.main
    ```

2. バッチワーカーの起動
    ```bash
    .\.venv\Scripts\activate
    set RUN_ENV=DEV
    set REDIS_HOST=localhost
    set REDIS_PORT=6380
    set GOOGLE_APPLICATION_CREDENTIALS=mab-ai-check-drawing-sa-key.json
    python -m batch_server.worker
    ```

3. フロントエンドの起動
    ```bash
    cd mock-job-demo
    npm run dev
    ```
