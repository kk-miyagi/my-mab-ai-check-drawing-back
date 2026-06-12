# api / batch / retention-cron 共通イメージ（同一コードベース、起動コマンドのみ docker-compose で切替）
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1

# poppler-utils: pdf2image / libgl1,libglib2.0-0: opencv / fonts-dejavu: ラベル描画フォント
# curl,ca-certificates: supercronic バイナリ取得用
RUN apt-get update && apt-get install -y --no-install-recommends \
        poppler-utils \
        libgl1 \
        libglib2.0-0 \
        fonts-dejavu-core \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# supercronic: コンテナ向け cron。retention-cron サービスが data-retention の
# enqueue ジョブ（main.py）を定期実行するために使用（functions/data-retention/README.md 参照）。
# sha1 は https://github.com/aptible/supercronic/releases/tag/v0.2.33 より。
ARG SUPERCRONIC_VERSION=v0.2.33
ARG TARGETARCH
RUN set -eux; \
    arch="${TARGETARCH:-amd64}"; \
    case "$arch" in \
        amd64) sha1="71b0d58cc53f6bd72cf2f293e09e294b79c666d8" ;; \
        arm64) sha1="e0f0c06ebc5627e43b25475711e694450489ab00" ;; \
        *) echo "unsupported TARGETARCH=$arch"; exit 1 ;; \
    esac; \
    bin="supercronic-linux-${arch}"; \
    curl -fsSLO "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/${bin}"; \
    echo "${sha1}  ${bin}" | sha1sum -c -; \
    chmod +x "${bin}"; \
    mv "${bin}" /usr/local/bin/supercronic

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# 既定は API サーバ。batch / retention-cron は docker-compose で command を上書きする。
CMD ["python", "test_app.py", "DEV"]
