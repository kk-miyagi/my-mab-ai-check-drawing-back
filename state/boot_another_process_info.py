from dataclasses import dataclass


@dataclass
class BaseBootAnotherProcessInfo:
    user: str
    epic: str
    operation: str
    operation_id: str
    status: str
