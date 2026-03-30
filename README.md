# mab-ai-check-drawing-back

## 🚀技術スタック

| 分類 | 技術 |
| --- | --- |
| フロントエンド | React, TypeScript, Vite |
| バックエンド | Python, FastAPI |
| API クライアント | Axios |
| パッケージマネージャー | npm(フロントエンド), pip(バックエンド) |

## 📁ディレクトリ構造
```
mab-ai-check-drawing-back
├─ backend_tasks/
├─ conf/
├─ create-label-responce/
├─ demo-create-label-responce/
├─ drawing-compare-responce/
├─ drawing-highlight-responce/
├─ drawing-review-responce/
├─ logs/
├─ manager/
├─ mock-job-demo/
├─ multi-fileupload/
├─ router/
├─ shell/
├─ state/
├─ state_func/
├─ test_scripts/
├─ .gitignore
├─ app_backend_task.py
├─ app_config.py
├─ app_logger.py
├─ app_manager.py
├─ app_router.py
├─ app_server.py
├─ app_state.py
├─ README.md
├─ requirements.txt
├─ test_app.py
└─ test_client.py
```

## 🛠️セットアップ
1. Gitのインストール
    ``` bash
    winget install --id Git.Git -e --source winget
    ```

2. Pythonのインストール
    ``` bash
    winget install -e --id Python.Python.3.12
    ```
3. Node.jsのインストール
    ``` bash
    winget install -e --id OpenJS.NodeJS.LTS
    ```
4. popperのインストール
    1. [こちら](https://github.com/oschwartz10612/poppler-windows/releases/)から最新のパッケージをダウンロード
    2. 展開して`C:\Program Files (x86)`へ移動
    3. パスを通す
        - システム環境変数の編集 > 環境変数 > システム環境変数のPathをクリック
        - 新規「C:\Program Files (x86)\poppler-25.12.0\Library\bin\」で保存
            - バージョンはインストールしたものに合わせて変更してください。

5. リポジトリのクローン
    ``` bash
    git clone https://tetralink-gitlab-prj-mab-ai-adv-util.apps.tetra-c2.sdc.ns-sol.co.jp/mab-ai-adv-util/mab-ai-check-drawing-back.git
    cd  mab-ai-check-drawing-back
    ```

6. 依存関係のインストール

    **フロントエンド**
    ``` bash
    cd mock-job-demo
    npm install
    ```

    **バックエンド**
    ``` bash
    # 仮想環境
    python -m venv .venv
    .\.venv\Scripts\activate

    pip install -r requirements.txt
    ```

7. 認証情報ファイルの配置

    [こちら](https://nssolgrp.sharepoint.com/:f:/r/sites/ind-AIPoC/Shared%20Documents/10.%E9%96%8B%E7%99%BA%E3%83%81%E3%83%BC%E3%83%A0/%E9%96%8B%E7%99%BA/%E6%A4%9C%E5%9B%B3/%E8%AA%8D%E8%A8%BC%E6%83%85%E5%A0%B1?csf=1&web=1&e=r1YKYm)から認証情報ファイルをダウンロードして、ディレクトリ直下に配置してください。

## 🏃実行方法

1. バックエンドの起動
    ``` bash
    .\.venv\Scripts\activate
    python test_app.py DEV
    ```

2. フロントエンドの起動
    ``` bash
    cd mock-job-demo
    npm run dev
    ```
