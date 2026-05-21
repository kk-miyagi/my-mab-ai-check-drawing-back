from dataclasses import dataclass


@dataclass
class DrawingHighlightInfo:
    user: str
    epic: str
    operation: str
    operation_id: str
    status: str
