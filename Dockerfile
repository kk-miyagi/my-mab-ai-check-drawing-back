# api / batch 共通イメージ（同一コードベース、起動コマンドのみ docker-compose で切替）
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1

# poppler-utils: pdf2image / libgl1,libglib2.0-0: opencv / fonts-dejavu: ラベル描画フォント
RUN apt-get update && apt-get install -y --no-install-recommends \
        poppler-utils \
        libgl1 \
        libglib2.0-0 \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# 既定は API サーバ。batch サービスは docker-compose で command を上書きする。
CMD ["python", "test_app.py", "DEV"]
