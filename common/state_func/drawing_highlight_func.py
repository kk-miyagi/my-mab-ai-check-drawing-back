import json
import dataclasses
from common.state.drawing_highlight_info import DrawingHighlightInfo

_PREFIX = "drawing_highlight"


def _key(hash_key: str) -> str:
    return f"{_PREFIX}:{hash_key}"


def _serialize(info: DrawingHighlightInfo) -> str:
    return json.dumps(dataclasses.asdict(info))


def _deserialize(data: str) -> DrawingHighlightInfo:
    d = json.loads(data)
    return DrawingHighlightInfo(
        user=d['user'],
        epic=d['epic'],
        operation=d['operation'],
        operation_id=d['operation_id'],
        status=d['status']
    )


def create_drawing_highlight_info(self):
    pass


def get_drawing_highlight_info(self, req_status):
    data = self.redis_client.get(_key(req_status.get_hash_key()))
    if data is None:
        return None
    return _deserialize(data)


def update_drawing_highlight_info(self, status):
    k = _key(status.get_hash_key())
    data = self.redis_client.get(k)
    if data is None:
        info = DrawingHighlightInfo(
            status.user,
            status.epic,
            status.operation,
            status.operation_id,
            status.status
        )
    else:
        info = _deserialize(data)
        info.status = status.status
    ttl = self.redis_client.ttl(k)
    expire = ttl if ttl > 0 else self.conf.expire
    self.redis_client.setex(k, expire, _serialize(info))
