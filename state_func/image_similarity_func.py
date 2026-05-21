import json
import dataclasses
from state.image_similarity_info import ImageSimilarityInfo

_PREFIX = "image_similarity"


def _key(hash_key: str) -> str:
    return f"{_PREFIX}:{hash_key}"


def _serialize(info: ImageSimilarityInfo) -> str:
    return json.dumps(dataclasses.asdict(info))


def _deserialize(data: str) -> ImageSimilarityInfo:
    d = json.loads(data)
    return ImageSimilarityInfo(
        user=d['user'],
        epic=d['epic'],
        operation=d['operation'],
        operation_id=d['operation_id'],
        status=d['status']
    )


def create_image_similarity_info(self):
    pass


def get_image_similarity_info(self, req_status):
    data = self.redis_client.get(_key(req_status.get_hash_key()))
    if data is None:
        return None
    return _deserialize(data)


def update_image_similarity_info(self, status):
    k = _key(status.get_hash_key())
    data = self.redis_client.get(k)
    if data is None:
        info = ImageSimilarityInfo(
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
