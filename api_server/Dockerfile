# API server: FastAPI + uvicorn.
# Build from repo root: docker build -f api_server/Dockerfile -t mab-api .

FROM python:3.12-slim

WORKDIR /app

# poppler-utils → pdf2image, libgl1/libglib2.0-0 → opencv runtime libs.
RUN apt-get update && apt-get install -y --no-install-recommends \
        poppler-utils \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY api_server/requirements.txt /app/api_server/requirements.txt
RUN pip install --no-cache-dir -r /app/api_server/requirements.txt

COPY common/ /app/common/
COPY api_server/ /app/api_server/

ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    DATA_ROOT=/app/shared_data \
    APP_LOG_FILE=/app/shared_data/logs/api/app_main.log \
    BATCH_LOG_FILE=/app/shared_data/logs/api/app_batch.log

EXPOSE 8000

CMD ["python", "-m", "api_server.main"]
