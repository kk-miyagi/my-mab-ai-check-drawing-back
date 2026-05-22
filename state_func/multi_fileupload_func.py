import json
import dataclasses
from state.multi_file_upload_info import MultiFileUploadInfo, FileInfo

_PREFIX = "multi_file_upload"


def _key(hash_key: str) -> str:
    return f"{_PREFIX}:{hash_key}"


def _serialize(info: MultiFileUploadInfo) -> str:
    return json.dumps(dataclasses.asdict(info))


def _deserialize(data: str) -> MultiFileUploadInfo:
    d = json.loads(data)
    file_infos = None
    if d['file_infos'] is not None:
        file_infos = [FileInfo(**fi) for fi in d['file_infos']]
    return MultiFileUploadInfo(
        user=d['user'],
        epic=d['epic'],
        operation=d['operation'],
        operation_id=d['operation_id'],
        status=d['status'],
        file_infos=file_infos,
        sum_number=d['sum_number']
    )


def create_multi_fileupload_info(self):
    pass


def get_multi_fileupload_info(self, req_status):
    data = self.redis_client.get(_key(req_status.get_hash_key()))
    if data is None:
        return None
    return _deserialize(data)


def update_multi_fileupload_info(self, status, file_info, sum_number=None):
    k = _key(status.get_hash_key())
    data = self.redis_client.get(k)
    if data is None:
        file_infos = None if file_info is None else [file_info]
        info = MultiFileUploadInfo(
            status.user,
            status.epic,
            status.operation,
            status.operation_id,
            status.status,
            file_infos,
            sum_number
        )
    else:
        info = _deserialize(data)
        info.status = status.status
        if file_info is not None:
            if info.file_infos is None:
                info.file_infos = []
            info.file_infos.append(file_info)
        info.sum_number = sum_number
    ttl = self.redis_client.ttl(k)
    expire = ttl if ttl > 0 else self.conf.expire
    self.redis_client.setex(k, expire, _serialize(info))
