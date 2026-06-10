from dataclasses import dataclass


@dataclass
class ImageSimilarityInfo:
    user: str
    epic: str
    operation: str
    operation_id: str
    status: str
