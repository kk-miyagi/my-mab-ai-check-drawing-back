import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Optional


@dataclass
class Job:
    """Job payload exchanged between api_server (publisher) and batch_server
    (consumer) via Redis Streams."""

    task_type: str
    user: str
    epic: str
    operation: str
    operation_id: str
    params: Dict[str, Any]
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: float = field(default_factory=time.time)

    @property
    def hash_key(self) -> str:
        return '_'.join([
            self.user or '',
            self.epic or '',
            self.operation or '',
            self.operation_id or ''
        ])

    def to_stream_fields(self) -> Dict[str, str]:
        """Encode for XADD. Redis Streams fields are flat string maps,
        so nested params are JSON-encoded."""
        return {
            'job_id': self.job_id,
            'task_type': self.task_type,
            'user': self.user or '',
            'epic': self.epic or '',
            'operation': self.operation or '',
            'operation_id': self.operation_id or '',
            'created_at': str(self.created_at),
            'params': json.dumps(self.params or {}, ensure_ascii=False),
        }

    @classmethod
    def from_stream_fields(cls, fields: Dict[str, str]) -> 'Job':
        params_raw = fields.get('params', '{}')
        try:
            params = json.loads(params_raw)
        except (json.JSONDecodeError, TypeError):
            params = {}
        return cls(
            job_id=fields.get('job_id', str(uuid.uuid4())),
            task_type=fields.get('task_type', ''),
            user=fields.get('user', ''),
            epic=fields.get('epic', ''),
            operation=fields.get('operation', ''),
            operation_id=fields.get('operation_id', ''),
            created_at=float(fields.get('created_at', time.time())),
            params=params,
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
