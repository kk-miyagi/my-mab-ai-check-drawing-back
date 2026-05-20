from dataclasses import dataclass


@dataclass
class DrawingHighlightInfo:
    user: str
    epic: str
    group_id: str
    operation: str
    operation_id: str
