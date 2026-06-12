# Data Retention — enqueue CLI

Script CLI đẩy một JOB dọn dữ liệu 検図 hết hạn lên Redis Streams. Được chạy
định kỳ bởi **supercronic** (cron cho container) trong service `retention-cron`
của docker-compose.

## What it does
`main.py <ENV>` `XADD` đúng **một** job (envelope `SYSTEM`) lên stream
`QUEUE.stream` (`jobs:batch`). `batch_worker` consume job và chạy
`backend_tasks/retention_delete_task.py`, script này tự scan Redis
`app_status:*`, chọn entry có `(now - create_time) > storage_expire_sec` AND
`status` final (`end=2`, `comp=3`, `error=-1`), rồi **xóa thật** (rmtree) thư
mục file tương ứng và `DEL` key Redis.

CLI này **không** scan Redis hay gọi HTTP — chỉ enqueue. Toàn bộ logic
scan/xóa nằm trong app chính (batch container).

## Trigger: supercronic trong docker-compose
- Service `retention-cron` (cùng image với api/batch) chạy
  `supercronic /app/functions/data-retention/retention.cron`.
- `retention.cron` định nghĩa lịch (mặc định 18:00 hằng ngày) gọi
  `python /app/functions/data-retention/main.py DEV`.
- supercronic exec command trực tiếp (không qua shell), log ra stdout — hợp
  với container. Đổi lịch/PROD: sửa `retention.cron`.
- Múi giờ: mặc định `TZ=UTC` (service `retention-cron`), nên `0 18 * * *` =
  18:00 UTC. Muốn 18:00 JST thì đặt `TZ=Asia/Tokyo` (image cần `tzdata`).

## Config
Per-environment JSON tại `conf/retention_conf_{dev,prod}.json`. Khóa bắt buộc:

| Key | Mô tả |
|-----|-------|
| `REDIS` | `host`, `port`, `password`, `ssl` (mặc định cho cloud) |
| `QUEUE.stream` | Tên Redis Stream để XADD (vd `jobs:batch`) |

**Redis có thể override bằng env** (giống app chính): `REDIS_HOST`,
`REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_SSL`, `REDIS_DB`. Trong docker-compose,
service `retention-cron` set `REDIS_HOST=redis`, `REDIS_SSL=false` để nối tới
Redis trong compose thay vì host trong file conf.

Retention period (`storage_expire_sec`) cấu hình ở app chính
(`conf/conf_{dev,prod}.json` → `DATA_RETENTION.storage_expire_sec`), không ở đây.

Env (`DEV`/`PROD`) chọn bằng tham số dòng lệnh của `main.py`.

## Run locally
```
# enqueue 1 job ngay (cần Redis; dùng REDIS_HOST=... nếu không phải localhost)
python main.py DEV
```
Hoặc qua compose: `docker compose up --build` rồi service `retention-cron` tự
chạy theo lịch.

## Test
```
python -m pytest tests/ -v
```

## Deploy
- **docker-compose**: service `retention-cron` đã cấu hình sẵn (supercronic).
- **Khác (k8s/VM)**: chạy `python functions/data-retention/main.py PROD` theo
  lịch (k8s CronJob / system cron), set `REDIS_*` env trỏ tới Redis tương ứng.

CLI chỉ kết nối Redis để XADD; không cần mount filesystem (việc xóa file do
batch worker thực hiện).
