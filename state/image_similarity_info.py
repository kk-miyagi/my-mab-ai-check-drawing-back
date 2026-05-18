from dataclasses import dataclass


@dataclass
class ImageSimilarityInfo:
    user: str
    epic: str
    group_id: str
    operation: str
    operation_id: str
