# Data Retention Function

Azure Function (Timer Trigger, Python 3.12) that soft-deletes expired
drawing-inspection storage data.

## What it does
Scans Redis `app_status:*` keys and selects entries whose `create_time` is
older than `RETENTION.storage_expire_sec` AND whose `group_status` is final
(`error=-1`, `end=2`, `comp=3`).  For each such entry it calls
`POST {API_BASE_URL}/api/data-retention/delete/` with an `X-API-Key` header
and JSON body `{"hash_key": <hk>}`.  The FastAPI app performs the actual
file move; this function has no filesystem access.  Redis keys are left to
expire via their own TTL.

HTTP responses are classified as:
- **2xx** — deleted (success)
- **409** — skipped (`api_not_final`, FastAPI says status is not yet final)
- **other** — failed

Set `DRY_RUN: true` to log decisions without making any HTTP calls.

## Config
Per-environment JSON in `conf/retention_conf_{dev,prod}.json`. Required keys:

| Key | Description |
|-----|-------------|
| `RETENTION.storage_expire_sec` | Seconds after which an entry is considered expired |
| `REDIS` | `host`, `port`, `password`, `ssl` for Azure Cache for Redis |
| `API_BASE_URL` | Base URL of the FastAPI app (e.g. `http://localhost:8000`) |
| `API_KEY` | Value sent in `X-API-Key` header |
| `APP_STATUS_PREFIX` | Redis key prefix (default `app_status`) |
| `TARGET_STATUSES` | Final statuses to act on (default `[-1, 2,3]`) |
| `DRY_RUN` | `true` to skip HTTP calls (default `false`) |

The environment is selected by the `APP_ENV` env var (`DEV`/`PROD`).

## Run locally
```
pip install -r requirements.txt pytest
python main.py DEV
```

## Test
```
python -m pytest tests/ -v
```

## Deploy
Standard Azure Functions Python v2 deploy. Required App Settings:
- `APP_ENV` — `DEV` or `PROD`
- `RETENTION_SCHEDULE` — NCRONTAB expression (e.g. `0 0 18 * * *` = daily 18:00 UTC)

The function makes outbound HTTP calls to the FastAPI app; no filesystem
mounts are required.
