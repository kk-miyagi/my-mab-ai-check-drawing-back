"""Shared dataclasses representing OCR-derived structures."""
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class OCRParagraph:
    paragraph_id: str
    text: str
    rect: Tuple[int, int, int, int]


@dataclass
class OCRToken:
    token_id: str
    text: str
    rect: Tuple[int, int, int, int]
    paragraph_id: str


@dataclass
class AggregatedToken:
    token_id: str
    text: str
    rect: Tuple[int, int, int, int]
    paragraph_id: str
    source_ids: List[str]
