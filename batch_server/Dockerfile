# Batch worker: subscribes to Redis Stream and dispatches AI tasks.
# Build from repo root: docker build -f batch_server/Dockerfile -t mab-batch .

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        poppler-utils \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY batch_server/requirements.txt /app/batch_server/requirements.txt
RUN pip install --no-cache-dir -r /app/batch_server/requirements.txt

COPY common/ /app/common/
COPY batch_server/ /app/batch_server/

# GCP service account key for Gemini / Vision; provide via bind-mount or secret
# at runtime if it should not be baked into the image.
COPY mab-ai-check-drawing-sa-key.json /app/mab-ai-check-drawing-sa-key.json

ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    DATA_ROOT=/app/shared_data \
    APP_LOG_FILE=/app/shared_data/logs/batch/app_main.log \
    BATCH_LOG_FILE=/app/shared_data/logs/batch/app_batch.log \
    GOOGLE_APPLICATION_CREDENTIALS=/app/mab-ai-check-drawing-sa-key.json

CMD ["python", "-m", "batch_server.worker"]
