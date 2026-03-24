import os
import csv
import io
import json
import sys
import re
import unicodedata
import argparse
import copy
from datetime import datetime
from pathlib import Path
from dataclasses import asdict, dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple, Union
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont
from vertexai.generative_models import GenerativeModel
from utils.dimension_models import AggregatedToken, OCRParagraph, OCRToken
from utils.gemini_response import (
    _json_safe,
    _log_gemini_error,
    _strip_code_fence,
    _write_json_file,
    get_raw_response,
)
from utils.test_vision_ocr import (
    _extract_paragraphs_and_tokens,
    perform_document_text_detection,
)
from utils.template_match_locator import locate_tiles
import vertexai
from utils.simple_multi_genemipronpt import (
        generate_with_multiple_contents,
        extract_first_json
)


REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.append(str(REPO_ROOT))

TokenLike = Union[OCRToken, AggregatedToken]

MAX_GEMINI_RETRIES = 3

TILE_IMAGE_EXTENSIONS: Tuple[str, ...] = (
        ".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff")


@dataclass
class TileRegion:
    name: str
    tile_path: Path
    rect: Tuple[int, int, int, int]
    match_score: float
    match_index: int = 1

    def as_row_context(self) -> Dict[str, object]:
        return {
            "rect": list(self.rect),
            "tile_name": self.name,
            "tile_path": str(self.tile_path),
            "match_score": self.match_score,
            "match_index": self.match_index,
        }


GEMINI_REGION_SEQUENCE: List[str] = [
    "global",
    "us-central1",
    "us-east1",
    "us-east4",
    "us-east5",
    "us-south1",
    "us-west1",
    "us-west4",
    "europe-central2",
    "europe-north1",
    "europe-southwest1",
    "europe-west1",
    "europe-west4",
    "europe-west8",
    "europe-west9",
]


def _resolve_vertex_project() -> Optional[str]:
    for key in (
            "VERTEX_PROJECT",
            "VERTEXAI_PROJECT",
            "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"):
        value = os.environ.get(key)
        if value:
            return value
    return "mab-ai-check-drawing"


def _is_rate_limit_error(response: object) -> bool:
    if response is None:
        return False
    message: Optional[str] = None
    if isinstance(response, dict):
        error_field = response.get("error")
        if isinstance(error_field, str):
            message = error_field
        elif error_field is not None:
            try:
                message = json.dumps(error_field, ensure_ascii=False)
            except Exception:
                message = str(error_field)
        elif "message" in response and isinstance(response["message"], str):
            message = response["message"]
    elif isinstance(response, BaseException):
        message = str(response)
    else:
        message = str(response)

    if not message:
        return False
    normalized = message.upper()
    return (
            "429" in normalized or
            "TOO MANY REQUESTS" in normalized or
            "RESOURCE_EXHAUSTED" in normalized
    )


class GeminiRegionManager:
    def __init__(self, model_name: str, regions: List[str]) -> None:
        self.model_name = model_name
        self.regions = [
                region.strip() for region in regions
                if region and region.strip()
        ]
        self.project = _resolve_vertex_project()
        self._region_index = 0

    @property
    def available(self) -> bool:
        return all(
            component is not None
            for component in (
                vertexai,
                GenerativeModel,
                generate_with_multiple_contents
            )
        )

    def _init_vertex(self, region: str) -> None:
        if vertexai is None:
            raise RuntimeError("vertexai SDK is not available")
        vertexai.init(project=self.project, location=region)

    def _advance_region(self) -> None:
        if not self.regions:
            return
        self._region_index = (self._region_index + 1) % len(self.regions)

    def generate(self, **kwargs):  # type: ignore[no-untyped-def]
        if not self.available:
            raise RuntimeError("GeminiRegionManager is not available")

        attempts = len(self.regions) if self.regions else 0
        if attempts == 0:
            raise RuntimeError("No Gemini regions configured")

        last_response: object = None
        for _ in range(attempts):
            region = self.regions[self._region_index]
            try:
                self._init_vertex(region)
                # type: ignore[misc]
                model_instance = GenerativeModel(self.model_name)
            except Exception as exc:
                last_response = {"error": str(exc)}
                self._advance_region()
                continue
            # type: ignore[misc]
            response = generate_with_multiple_contents(
                    model_instance, **kwargs)
            if not _is_rate_limit_error(response):
                return response

            print(f"429エラーを検知したためリージョンを切り替えます: {region}")
            last_response = response
            self._advance_region()

        return last_response


_gemini_manager: Optional[GeminiRegionManager] = None
if GenerativeModel is not None and generate_with_multiple_contents is not None:
    _gemini_manager = GeminiRegionManager(
            "gemini-2.5-pro", GEMINI_REGION_SEQUENCE)
    if not _gemini_manager.available:
        _gemini_manager = None


# Helper wrapper to keep the rest of the module agnostic to region management.
def _gemini_generate(**kwargs):  # type: ignore[no-untyped-def]
    if _gemini_manager is None:
        return {"error": "Gemini model is not available"}
    try:
        return _gemini_manager.generate(**kwargs)
    except Exception as exc:  # pragma: no cover - defensive guard
        return {"error": str(exc)}


def _extract_error(response: object) -> Optional[str]:
    if isinstance(response, dict) and "error" in response:
        error_value = response.get("error")
        if isinstance(error_value, str):
            return error_value
        if error_value is not None:
            return str(error_value)
    return None


def _list_tile_images(tile_dir: Path) -> List[Path]:
    if not tile_dir.exists():
        return []
    files: List[Path] = []
    for path in tile_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in TILE_IMAGE_EXTENSIONS:
            files.append(path)
    return sorted(files)


def _detect_tile_regions(
    original_path: Path,
    tile_dir: Path,
    *,
    tolerance: float,
    max_results: int,
) -> List[TileRegion]:
    if locate_tiles is None:
        print("OpenCVが利用できないため、テンプレートマッチングをスキップします。")
        return []
    tile_paths = _list_tile_images(tile_dir)
    if not tile_paths:
        print(f"タイル画像が見つかりません: {tile_dir}")
        return []
    original_stem = original_path.stem.lower()
    stem_filtered = [
            path for path in tile_paths
            if original_stem in path.stem.lower()]
    if stem_filtered:
        tile_paths = stem_filtered
    try:
        matches_by_tile = locate_tiles(
            original_path=original_path,
            tile_paths=tile_paths,
            tolerance=tolerance,
            max_results=max_results,
        )
    except Exception as exc:
        print(f"テンプレートマッチングに失敗しました: {exc}")
        return []
    if not isinstance(matches_by_tile, dict):
        print("テンプレートマッチ結果の形式が想定外です。")
        return []
    tile_regions: List[TileRegion] = []
    for tile_path, matches in matches_by_tile.items():
        if not matches:
            continue
        for idx, match in enumerate(matches, start=1):
            try:
                rect = (
                        match.x,
                        match.y,
                        match.x + match.width,
                        match.y + match.height)
                score = float(getattr(match, "score", 0.0))
            except AttributeError:
                continue
            if len(matches) == 1:
                label = Path(tile_path).stem
            else:
                label = f"{Path(tile_path).stem}_{idx}"
            tile_regions.append(
                TileRegion(
                    name=label,
                    tile_path=Path(tile_path),
                    rect=rect,
                    match_score=score,
                    match_index=idx,
                )
            )
    tile_regions.sort(key=lambda item: (item.tile_path.name, item.match_index))
    if tile_regions:
        print_str = f"テンプレートマッチングで {len(tile_regions)} 箇所を検出しました"
        print_str += f"(tolerance={tolerance}, max_results={max_results})."
        print(print_str)
    else:
        print("テンプレートマッチングで一致が見つかりませんでした。")
    return tile_regions


def _rows_to_csv(rows: List[List[str]]) -> str:
    if not rows:
        return ""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["項目", "寸法値または品質指定等の記載内容", "備考"])
    writer.writerows(rows)
    return buffer.getvalue()


def _stringify_compare_summary(summary: Optional[object]) -> str:
    if summary is None:
        return "該当部分のみを解析してください。"
    if isinstance(summary, str):
        stripped = summary.strip()
        return stripped or "該当部分のみを解析してください。"
    if isinstance(summary, (list, tuple)):
        flattened = []
        for item in summary:
            if item is None:
                continue
            flattened.append(str(item).strip())
        joined = "\n".join(part for part in flattened if part)
        return joined or "該当部分のみを解析してください。"
    if isinstance(summary, dict):
        try:
            return json.dumps(summary, ensure_ascii=False, indent=2)
        except Exception:
            return str(summary)
    return str(summary)


def _call_gemini_for_tile_dimensions(
    tile_region: TileRegion,
    *,
    original_name: str,
    compare_summary: Optional[object] = None,
) -> Optional[str]:
    if _gemini_manager is None:
        return None
    region = tile_region.rect
    region_text = f"x={region[0]}-{region[2]} / y={region[1]}-{region[3]}"
    summary_block = _stringify_compare_summary(compare_summary)
    tile_prompt = f"""
        図面{original_name}の切り出し画像"{tile_region.name}"を解析し、この領域に含まれるすべての寸法・品質指定を洗い出してください。
        元画像での座標: {region_text}

        参考となる図面全体の特徴情報:
        {summary_block}

        ルール:
        1. "項目","寸法値または品質指定等の記載内容","備考"の3カラムでCSVを出力してください。
        2. 項目には投影図名や該当ブロックの説明(例: {tile_region.name})を明記してください。
        3. 寸法値や品質指定の記述は図面にある文字列を忠実に記載してください。
        4. 備考には値の意味や、対応する注記/記号があれば簡潔に追記してください。
        5. CSV形式以外の余計なテキストやマークダウン記法は使用しないでください。
    """
    result = _gemini_generate(
        image_paths=[str(tile_region.tile_path)],
        prompts=[tile_prompt],
    )
    error_message = _extract_error(result)
    if error_message:
        print(f"タイル{tile_region.name}の寸法抽出でエラーが発生しました: {error_message}")
        return None
    csv_text = get_raw_response(result)
    if not isinstance(csv_text, str):
        return None
    return csv_text


def _generate_tile_dimension_rows(
    tile_regions: Sequence[TileRegion],
    *,
    original_name: str,
    compare_summary: Optional[object] = None,
) -> Tuple[List[List[str]], Dict[int, Dict[str, object]]]:
    combined_rows: List[List[str]] = []
    row_tile_map: Dict[int, Dict[str, object]] = {}
    for tile_region in tile_regions:
        csv_text = _call_gemini_for_tile_dimensions(
            tile_region,
            original_name=original_name,
            compare_summary=compare_summary,
        )
        if not csv_text:
            continue
        parsed_rows = _parse_csv_rows(csv_text)
        parsed_rows = [
                row for row in parsed_rows if not _is_code_fence_row(row)]
        if not parsed_rows:
            continue
        print(f"タイル{tile_region.name}: {len(parsed_rows)}件の寸法候補を取得しました。")
        for row in parsed_rows:
            combined_rows.append(row)
            row_index = len(combined_rows)
            row_tile_map[row_index] = tile_region.as_row_context()
    return combined_rows, row_tile_map


# サービスアカウントキーファイルのパスを設定
os.environ[
        'GOOGLE_APPLICATION_CREDENTIALS'
] = 'mab-ai-check-drawing-sa-key.json'


def _coerce_csv_string(payload: object) -> Optional[str]:
    if payload is None:
        return None
    if isinstance(payload, str):
        return payload
    if isinstance(payload, list):
        return "\n".join(str(item) for item in payload)
    return str(payload)


def _parse_csv_rows(csv_text: str) -> List[List[str]]:
    if not csv_text:
        return []
    reader = csv.reader(io.StringIO(csv_text))
    rows: List[List[str]] = []
    for row in reader:
        cleaned = [col.strip() for col in row]
        if any(cleaned):
            rows.append(cleaned)
    return rows


def _is_code_fence_row(row: List[str]) -> bool:
    if not row:
        return False
    content = "".join(cell.strip() for cell in row)
    if content in {"```", "```csv"}:
        return True

    normalized = [cell.strip() for cell in row if isinstance(cell, str)]
    header_variants = [
        ["項目", "寸法値または品質指定等の記載内容", "備考"],
        ["No", "項目", "寸法値または品質指定等の記載内容", "備考"],
    ]
    for header in header_variants:
        if normalized[: len(header)] == header:
            return True

    return False


def _rect_mid_y(rect: Tuple[int, int, int, int]) -> float:
    return (rect[1] + rect[3]) / 2.0


def _compose_group_text(tokens: List[OCRToken]) -> str:
    parts = [token.text.strip() for token in tokens if token.text.strip()]
    if not parts:
        return ""
    text = " ".join(parts)
    text = re.sub(r"\s+([\),.;:%±°×x])", r"\1", text)
    text = re.sub(r"([(])\s+", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _merge_tokens(
    tokens: List[OCRToken],
    *,
    gap_threshold_px: int = 40,
    line_threshold_px: int = 18,
) -> List[AggregatedToken]:
    if not tokens:
        return []

    tokens_by_paragraph: Dict[str, List[OCRToken]] = {}
    for token in tokens:
        paragraph_id = token.paragraph_id or "__none__"
        tokens_by_paragraph.setdefault(paragraph_id, []).append(token)

    aggregated: List[AggregatedToken] = []
    group_counter = 0

    for paragraph_id, paragraph_tokens in tokens_by_paragraph.items():
        paragraph_tokens.sort(key=lambda t: (t.rect[1], t.rect[0]))
        current_group: List[OCRToken] = []

        for token in paragraph_tokens:
            if not current_group:
                current_group.append(token)
                continue

            prev = current_group[-1]
            same_line = abs(
                    _rect_mid_y(prev.rect) - _rect_mid_y(token.rect)
            ) <= line_threshold_px
            gap = token.rect[0] - prev.rect[2]
            punct = token.text.strip() in {",", ";", ":", ")", "]", "}", "°"}

            if same_line and (gap <= gap_threshold_px or punct):
                current_group.append(token)
                continue

            group_counter += 1
            text = _compose_group_text(current_group)
            rect = _union_token_rects(current_group)
            source_ids = [item.token_id for item in current_group]
            aggregated.append(
                AggregatedToken(
                    token_id=f"grp_{paragraph_id}_{group_counter}",
                    text=text,
                    rect=rect,
                    paragraph_id=paragraph_id,
                    source_ids=source_ids,
                )
            )
            current_group = [token]

        if current_group:
            group_counter += 1
            text = _compose_group_text(current_group)
            rect = _union_token_rects(current_group)
            source_ids = [item.token_id for item in current_group]
            aggregated.append(
                AggregatedToken(
                    token_id=f"grp_{paragraph_id}_{group_counter}",
                    text=text,
                    rect=rect,
                    paragraph_id=paragraph_id,
                    source_ids=source_ids,
                )
            )

    aggregated.sort(key=lambda t: (t.rect[1], t.rect[0]))
    return aggregated


def _normalize_text_for_match(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text or "")
    normalized = normalized.replace("×", "x").replace("Ｘ", "x")
    normalized = normalized.replace("−", "-").replace("–", "-")
    normalized = normalized.replace("±", "+-")
    normalized = normalized.replace("°", "deg")
    normalized = normalized.replace("Φ", "phi").replace(
            "Ø", "phi").replace("φ", "phi")
    normalized = normalized.replace("，", ",").replace("．", ".")
    normalized = re.sub(r"\s+", "", normalized)
    filtered = [ch for ch in normalized if ch.isalnum() or ch in ".,+-x_"]
    return "".join(filtered).upper()


def _union_token_rects(
        tokens: List[TokenLike]) -> Optional[Tuple[int, int, int, int]]:
    if not tokens:
        return None
    xs_min = min(token.rect[0] for token in tokens)
    ys_min = min(token.rect[1] for token in tokens)
    xs_max = max(token.rect[2] for token in tokens)
    ys_max = max(token.rect[3] for token in tokens)
    return xs_min, ys_min, xs_max, ys_max


def _ensure_rect_tuple(
        rect_value: object) -> Optional[Tuple[int, int, int, int]]:
    if isinstance(rect_value, dict):
        rect_value = rect_value.get("rect")
    if isinstance(rect_value, (list, tuple)) and len(rect_value) == 4:
        try:
            coords = [int(round(float(coord))) for coord in rect_value]
        except (TypeError, ValueError):
            return None
        x1, y1, x2, y2 = coords
        if x2 < x1:
            x1, x2 = x2, x1
        if y2 < y1:
            y1, y2 = y2, y1
        return x1, y1, x2, y2
    return None


def _expand_rect(
    rect: Tuple[int, int, int, int],
    padding: int,
    image_size: Optional[Tuple[int, int]] = None,
) -> Tuple[int, int, int, int]:
    if padding <= 0:
        return rect
    x1, y1, x2, y2 = rect
    x1 -= padding
    y1 -= padding
    x2 += padding
    y2 += padding
    if image_size:
        width, height = image_size
        x1 = max(0, min(x1, width))
        y1 = max(0, min(y1, height))
        x2 = max(0, min(x2, width))
        y2 = max(0, min(y2, height))
    return x1, y1, x2, y2


def _rects_intersect(
        a: Tuple[int, int, int, int], b: Tuple[int, int, int, int]) -> bool:
    return not (a[0] >= b[2] or a[2] <= b[0] or a[1] >= b[3] or a[3] <= b[1])


def _filter_tokens_by_rect(
    tokens: List[OCRToken],
    rect: Tuple[int, int, int, int],
    *,
    padding: int,
    image_size: Optional[Tuple[int, int]] = None,
) -> List[OCRToken]:
    expanded = _expand_rect(rect, padding, image_size)
    return [
       token for token in tokens
       if token.rect and _rects_intersect(token.rect, expanded)
    ]


def _filter_paragraphs_by_rect(
    paragraphs: List[OCRParagraph],
    rect: Tuple[int, int, int, int],
    *,
    padding: int,
    image_size: Optional[Tuple[int, int]] = None,
) -> List[OCRParagraph]:
    expanded = _expand_rect(rect, padding, image_size)
    return [
        paragraph for paragraph in paragraphs
        if paragraph.rect and _rects_intersect(paragraph.rect, expanded)
    ]


def _normalize_tile_row_context(entry: object) -> Optional[Dict[str, object]]:
    if isinstance(entry, dict):
        rect_candidate = entry.get("rect") if "rect" in entry else entry
        rect = _ensure_rect_tuple(rect_candidate)
        if rect is None:
            return None
        normalized = dict(entry)
        normalized["rect"] = rect
        return normalized
    rect = _ensure_rect_tuple(entry)
    if rect is None:
        return None
    return {"rect": rect}


def _serialize_tile_row_context(entry: Dict[str, object]) -> Dict[str, object]:
    serialized = dict(entry)
    rect_value = serialized.get("rect")
    if isinstance(rect_value, tuple):
        serialized["rect"] = list(rect_value)
    return serialized


_DIMENSION_ALPHA_ALLOWED = {"R", "X", "T", "M", "C", "L"}
_DIMENSION_SUBSTRINGS_ALLOWED = ("PHI", "DEG")


def _is_dimension_like_text(text: str) -> bool:
    candidate = text.strip() if text else ""
    if not candidate:
        return False

    normalized = _normalize_text_for_match(candidate)
    if not normalized:
        return False

    if not any(ch.isdigit() for ch in normalized):
        return False

    temp = normalized
    for allowed in _DIMENSION_SUBSTRINGS_ALLOWED:
        temp = temp.replace(allowed, "")

    alpha_chars = {ch for ch in temp if ch.isalpha()}
    if alpha_chars and not alpha_chars.issubset(_DIMENSION_ALPHA_ALLOWED):
        return False

    digits = [ch for ch in normalized if ch.isdigit()]
    if len(digits) == 1 and len(normalized) <= 2:
        return False

    return True


def _matches_from_dimension_tokens(
        tokens: List[AggregatedToken]) -> List[Dict[str, object]]:
    matches: List[Dict[str, object]] = []
    for idx, token in enumerate(tokens, start=1):
        if not _is_dimension_like_text(token.text):
            continue
        rect = token.rect
        matches.append(
            {
                "row_index": idx,
                "row": [token.text],
                "rect": rect,
                "token_ids": [token.token_id],
                "source_token_ids": list(token.source_ids),
                "matched_text": token.text,
                "match_source": "ocr-heuristic",
                "error_logs": [],
            }
        )
    return matches


def _build_dimension_query(row: List[str]) -> str:
    if not row:
        return ""

    primary_values: List[str] = []
    for idx in (0, 1):
        if idx < len(row) and isinstance(row[idx], str):
            value = row[idx].strip()
            if value:
                primary_values.append(value)

    if not primary_values:
        fallback_values = [
                cell.strip() for cell in row
                if isinstance(cell, str) and cell.strip()
        ]
        unique_fallback = []
        for cell in fallback_values:
            if cell not in unique_fallback:
                unique_fallback.append(cell)
        primary_values = unique_fallback

    if not primary_values:
        return ""

    joined = " / ".join(primary_values)
    return (
        "次の項目と寸法・品質指定に対応する図面上の記載を特定し、そのトークンIDについて教えてください。\n"
        "同じ記載が複数ある場合もあります。その場合はいずれか一つを選択してください\n"
        f"対象: {joined}"
    )


def _primary_dimension_text(row: List[str]) -> str:
    if not row:
        return ""

    if len(row) > 1 and isinstance(row[1], str) and row[1].strip():
        return row[1].strip()

    fallback_indices = [0, 2]
    for idx in fallback_indices:
        if idx < len(row) and isinstance(row[idx], str):
            candidate = row[idx].strip()
            if candidate:
                return candidate

    for cell in row:
        if isinstance(cell, str) and cell.strip():
            return cell.strip()

    return ""


def _call_gemini_for_dimension_match(
    paragraphs: List[OCRParagraph],
    tokens: List[OCRToken],
    image_path: Path,
    query: str,
    *,
    log_dir: Optional[Path] = None,
    row_index: Optional[int] = None,
    attempt: int = 1,
) -> Tuple[List[Dict[str, object]], List[Path]]:
    query = (query or "").strip()
    if not query or not tokens:
        return [], []

    if _gemini_manager is None:
        return [], []

    if not image_path.exists():
        print(f"画像ファイルが見つかりません: {image_path}")
        return [], []

    log_paths: List[Path] = []
    log_name: Optional[str] = None
    request_log_path: Optional[Path] = None
    response_log_path: Optional[Path] = None
    if log_dir is not None and row_index is not None:
        log_name = f"row_{row_index:03d}_attempt_{attempt}"
        request_log_path = log_dir / f"{log_name}_request.json"
        response_log_path = log_dir / f"{log_name}_response.json"

    tokens_payload = [
        {
            "id": token.token_id,
            "text": token.text,
            "rect": {
                "min_x": token.rect[0],
                "min_y": token.rect[1],
                "max_x": token.rect[2],
                "max_y": token.rect[3],
            },
            "paragraph_id": token.paragraph_id,
        }
        for token in tokens
    ]

    paragraphs_payload = [
        {
            "id": paragraph.paragraph_id,
            "text": paragraph.text,
            "rect": {
                "min_x": paragraph.rect[0],
                "min_y": paragraph.rect[1],
                "max_x": paragraph.rect[2],
                "max_y": paragraph.rect[3],
            },
        }
        for paragraph in paragraphs
    ]

    ins_str = "Ret only the OCR tokens that directly support the query."
    payload: Dict[str, object] = {
        "query": query,
        "tokens": tokens_payload,
        "paragraphs": paragraphs_payload,
        "instructions": ins_str
    }

    system_prompt = (
        f"あなたは製造図面{image_path.name}のOCR結果と、LLMを使って取得した結果をもとに正しくその設計指示と位置を把握するためのアシスタントです。"
        "入力JSONには製造図面に関するトークン情報と段落情報が含まれています。"
        "ユーザーの query 内に寸法または設計指示があり、その値が含まれているもしくは、その値だと思われるトークンだけを matches に含めてください。"
        "また、判断根拠が見つからない場合は、matches を空にしてください。"
        "必ず次のJSON形式で応答してください:\n"
        "{\n  \"matches\": [\n    {\n      \"summary\": string,\n      \"token_ids\": [string, ...],\n      \"reason\": string (optional)\n    }\n  ]\n}\n"
        "token_ids は存在するIDのみを使用してください。判断根拠とならないようなトークンを含めないでください。token_163のように出力してください"
        "summary にはそのグループの要約を簡潔に記載してください。"
    )

    payload_text = json.dumps(payload, ensure_ascii=False)

    prompts = [system_prompt, f"query:\n{query}\nINPUT_JSON:\n{payload_text}"]

    if request_log_path is not None:
        _write_json_file(
            request_log_path,
            {
                "timestamp": datetime.now().isoformat(timespec="seconds"),
                "row_index": row_index,
                "attempt": attempt,
                "image_path": str(image_path),
                "query": query,
                "payload": payload,
                "prompts": prompts,
            },
        )
        log_paths.append(request_log_path)

    result = _gemini_generate(
        image_paths=[str(image_path)],
        prompts=prompts,
    )
    if response_log_path is not None:
        _write_json_file(
            response_log_path,
            {
                "timestamp": datetime.now().isoformat(timespec="seconds"),
                "row_index": row_index,
                "attempt": attempt,
                "image_path": str(image_path),
                "query": query,
                "raw_result": _json_safe(result),
            },
        )
        log_paths.append(response_log_path)
    error_message = _extract_error(result)
    if error_message:
        print(f"LLMによる寸法マッチング呼び出しでエラーが発生しました: {error_message}")
        log_path = _log_gemini_error(
            "dimension_match_call",
            payload=payload,
            prompts=prompts,
            response=result,
            extra={
                "image_path": str(image_path),
                "query": query,
                "row_index": row_index,
                "attempt": attempt,
                "log_name": log_name,
            },
        )
        if log_path:
            log_paths.append(log_path)
        return [], log_paths

    data: Optional[Dict[str, object]] = None

    if isinstance(result, dict):
        raw_response = None
        if isinstance(result, dict):
            raw_response = result.get("raw_response")

        if raw_response and extract_first_json is not None:
            parsed = extract_first_json(str(raw_response))
            if isinstance(parsed, dict):
                data = parsed
        if data is None and isinstance(result, dict):
            data = result
    else:
        candidate_text = str(result)
        if extract_first_json is not None:
            parsed = extract_first_json(candidate_text)
            if isinstance(parsed, dict):
                data = parsed
        if data is None:
            stripped = _strip_code_fence(candidate_text)
            try:
                data = json.loads(stripped)
            except Exception:
                data = None

    if not isinstance(data, dict):
        print("Gemini応答を辞書として解釈できませんでした。")
        log_path = _log_gemini_error(
            "dimension_match_parse",
            payload=payload,
            prompts=prompts,
            response=result,
            extra={
                "image_path": str(image_path),
                "query": query,
                "row_index": row_index,
                "attempt": attempt,
                "log_name": log_name,
            },
        )
        if log_path:
            log_paths.append(log_path)
        return [], log_paths

    matches_payload = data.get("matches")
    if not isinstance(matches_payload, list):
        print("Gemini応答に matches 配列が見つかりませんでした。")
        print(data)
        log_path = _log_gemini_error(
            "dimension_match_missing_matches",
            payload=payload,
            prompts=prompts,
            response=data,
            extra={
                "image_path": str(image_path),
                "query": query,
                "row_index": row_index,
                "attempt": attempt,
                "log_name": log_name,
            },
        )
        if log_path:
            log_paths.append(log_path)
        return [], log_paths

    normalized: List[Dict[str, object]] = []
    for match in matches_payload:
        if not isinstance(match, dict):
            continue
        token_ids = match.get("token_ids") or match.get("tokens")
        if not isinstance(token_ids, list):
            continue
        valid_ids = [tid for tid in token_ids if isinstance(tid, str)]
        if not valid_ids:
            continue
        normalized.append(
            {
                "token_ids": valid_ids,
                "summary": str(match.get("summary") or ""),
                "confidence": match.get("confidence"),
                "reason": match.get("reason"),
            }
        )

    return normalized, log_paths


def _load_mab_tokens(
        image_path: Path
) -> Tuple[
        List[AggregatedToken],
        List[OCRToken],
        List[OCRParagraph],
        Tuple[int, int]]:
    response = perform_document_text_detection(image_path)
    with Image.open(image_path) as img:
        image_size = img.size
    full_text_annotation = getattr(response, "full_text_annotation", None)
    paragraphs, tokens = _extract_paragraphs_and_tokens(
            full_text_annotation, image_size)
    aggregated_tokens = _merge_tokens(tokens)
    return aggregated_tokens, tokens, paragraphs, image_size


def _annotate_matches(
    image_path: Path,
    matches: List[Dict[str, object]],
    output_dir: str,
    *,
    suffix: str = "_annotated_dims",
    outline: str = "red",
    label_prefix: str = "",
    start_index: int = 1,
    box_on: bool = True
) -> Optional[Path]:
    if not matches:
        return None

    # TODO pdf 対応(pdfだったら画像ファイルに変換
    annotated_path = image_path.with_name(
            f"{image_path.stem}{suffix}{image_path.suffix}")
    with Image.open(image_path).convert("RGB") as img:
        drawer = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("arial.ttf", size=40)
        except Exception:
            try:
                font = ImageFont.truetype("DejaVuSans.ttf", size=40)
            except Exception:
                font = ImageFont.load_default()
        for idx, match in enumerate(matches, start=start_index):
            rect = match.get("rect")
            if not rect:
                continue
            if box_on:
                drawer.rectangle(rect, outline=outline, width=4)
            label_text = f"{label_prefix}{idx}" if label_prefix else str(idx)
            if hasattr(font, "getbbox"):
                bbox = font.getbbox(label_text)
                label_height = bbox[3] - bbox[1]
                label_weight = bbox[2] - bbox[0]
            else:
                label_height = 14
                label_weight = 40 * 2
                if hasattr(font, "getsize"):
                    label_height = font.getsize(label_text)[1]
            label_x = rect[0]
            label_y = max(rect[1] - label_height - 4, 0)
            if not box_on and ((rect[3] - rect[1]) > 2 * label_height):
                label_y = min(rect[1] + label_height + 4, rect[3])
            if not box_on and ((rect[2] - rect[0]) * 0.7 < label_weight):
                label_x = min(rect[0] - label_weight - 4, rect[0])

            label_anchor = (label_x, label_y)
            drawer.text(label_anchor, label_text, fill=outline, font=font)
        if not os.path.isdir(output_dir):
            os.makedirs(output_dir)
        output_path = f"{output_dir}{annotated_path.name}"
        img.save(output_path)
        # TODO pdf も保存する

    return output_path


def _export_matches_csv(
    image_path: Path,
    matches: List[Dict[str, object]],
    output_dir: str,
    *,
    filename_suffix: str = "_matched_dimensions",
    start_index: int = 1,
) -> Optional[Path]:
    if not matches:
        return None

    output_fname = image_path.with_name(
            f"{image_path.stem}{filename_suffix}.csv")
    output_path = f"{output_dir}{output_fname.name}"

    def _get_row_value(row_data: object, index: int) -> str:
        if isinstance(row_data, list) and index < len(row_data):
            value = row_data[index]
            return str(value).strip() if value is not None else ""
        return ""

    def _format_reason(entry: Dict[str, object]) -> str:
        parts: List[str] = []
        source = entry.get("match_source")
        if source:
            parts.append(f"source={source}")
        matched_text = entry.get("matched_text")
        if matched_text:
            parts.append(f"text={matched_text}")
        token_ids = entry.get("token_ids") or entry.get("source_token_ids")
        if isinstance(token_ids, list) and token_ids:
            parts.append(
                    "token_ids=" + " ".join(str(tid) for tid in token_ids))
        confidence = entry.get("llm_confidence")
        if confidence is not None:
            parts.append(f"confidence={confidence}")
        summary = entry.get("llm_summary")
        if summary:
            parts.append(f"summary={summary}")
        llm_reason = entry.get("llm_reason")
        if llm_reason:
            parts.append(f"llm_reason={llm_reason}")
        reason = entry.get("reason")
        if reason:
            parts.append(f"reason={reason}")
        error_logs = entry.get("error_logs")
        if isinstance(error_logs, list) and error_logs:
            parts.append("logs=" + ";".join(str(log) for log in error_logs))
        return " | ".join(str(part) for part in parts if part)

    with open(output_path, "w", newline="", encoding="utf-8-sig") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["No", "項目", "寸法値または品質指定等の記載内容", "備考", "理由およびエラーログ"])
        for idx, match in enumerate(matches, start=start_index):
            row_data = match.get("row")
            item = _get_row_value(row_data, 0)
            value = _get_row_value(row_data, 1)
            note = _get_row_value(row_data, 2)
            reason_text = _format_reason(match)
            writer.writerow([idx, item, value, note, reason_text])

    return output_path


def _export_unmatched_csv(
    image_path: Path,
    unmatched_entries: List[Dict[str, object]],
    output_dir: str,
    *,
    filename_suffix: str = "_unmatched_dimensions",
    start_index: int = 1,
) -> Optional[Path]:
    if not unmatched_entries:
        return None

    output_path = image_path.with_name(
            f"{image_path.stem}{filename_suffix}.csv")
    output_path = f"{output_dir}{output_path.name}"

    def _get_row_value(row_data: object, index: int) -> str:
        if isinstance(row_data, list) and index < len(row_data):
            value = row_data[index]
            return str(value).strip() if value is not None else ""
        return ""

    def _format_reason(entry: Dict[str, object]) -> str:
        parts: List[str] = []
        reason = entry.get("reason")
        if reason:
            parts.append(str(reason))
        error_logs = entry.get("error_logs")
        if isinstance(error_logs, list) and error_logs:
            parts.append("logs=" + ";".join(str(log) for log in error_logs))
        return " | ".join(parts)

    with open(output_path, "w", newline="", encoding="utf-8-sig") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["No", "項目", "寸法値または品質指定等の記載内容", "備考", "理由およびエラーログ"])
        for idx, entry in enumerate(
                sorted(
                    unmatched_entries,
                    key=lambda item: item.get("row_index", 0)),
                start=start_index):
            row_data = entry.get("row")
            item = _get_row_value(row_data, 0)
            value = _get_row_value(row_data, 1)
            note = _get_row_value(row_data, 2)
            reason_text = _format_reason(entry)
            writer.writerow([idx, item, value, note, reason_text])

    return output_path

def highlight_mab_dimensions(
    dir_name: str,
    file_list: Dict,
    csv_payload: object,
    output_dir: str,
    *,
    target_row_indices: Optional[Iterable[int]] = None,
    reuse_matches: Optional[Iterable[Dict[str, object]]] = None,
    reuse_unmatched_entries: Optional[Iterable[Dict[str, object]]] = None,
    row_tile_regions: Optional[Dict[int, Dict[str, object]]] = None,
    region_padding_px: int = 20,
    box_on: bool = True
) -> Optional[Path]:
    csv_text = _coerce_csv_string(csv_payload)
    rows = _parse_csv_rows(csv_text) if csv_text else []
    rows = [row for row in rows if not _is_code_fence_row(row)]

    normalized_row_tile_regions: Dict[int, Dict[str, object]] = {}
    if row_tile_regions:
        if isinstance(row_tile_regions, dict):
            items = row_tile_regions.items()
        elif isinstance(row_tile_regions, list):
            items = enumerate(row_tile_regions, start=1)
        else:
            items = []
        for raw_idx, entry in items:
            try:
                idx = int(raw_idx)
            except (TypeError, ValueError):
                continue
            normalized = _normalize_tile_row_context(entry)
            if normalized:
                normalized_row_tile_regions[idx] = normalized

    indexed_rows: List[Tuple[int, List[str]]] = [
            (idx, row) for idx, row in enumerate(rows, start=1)]
    original_row_count = len(indexed_rows)

    target_row_set: Optional[set[int]] = None
    if target_row_indices is not None:
        target_row_set = {int(idx) for idx in target_row_indices}
        indexed_rows = [
                item for item in indexed_rows if item[0] in target_row_set]
        if normalized_row_tile_regions:
            normalized_row_tile_regions = {
                idx: entry
                for idx, entry in normalized_row_tile_regions.items()
                if idx in target_row_set
            }

    existing_matches: List[Dict[str, object]] = []
    if reuse_matches:
        for entry in reuse_matches:
            if not isinstance(entry, dict):
                continue
            copied_entry = copy.deepcopy(entry)
            row_idx = copied_entry.get("row_index")
            try:
                if row_idx is not None:
                    copied_entry["row_index"] = int(row_idx)
            except (TypeError, ValueError):
                pass
            existing_matches.append(copied_entry)

    carryover_unmatched: List[Dict[str, object]] = []
    if reuse_unmatched_entries:
        for entry in reuse_unmatched_entries:
            if not isinstance(entry, dict):
                continue
            copied_entry = copy.deepcopy(entry)
            row_idx = copied_entry.get("row_index")
            try:
                if row_idx is not None:
                    copied_entry["row_index"] = int(row_idx)
            except (TypeError, ValueError):
                pass
            carryover_unmatched.append(copied_entry)

    if target_row_set is not None and carryover_unmatched:
        carryover_unmatched = [
            entry
            for entry in carryover_unmatched
            if entry.get("row_index") not in target_row_set
        ]

    if existing_matches:
        reused_rows = sorted(
            {
                entry.get("row_index")
                for entry in existing_matches
                if isinstance(entry.get("row_index"), int)
            }
        )
        if reused_rows:
            print(f"前回成功した行を再利用します: {reused_rows}")
        else:
            print(f"前回成功した結果を {len(existing_matches)} 件再利用します。")

    if (
            target_row_indices is not None and
            not indexed_rows and
            not existing_matches and
            not carryover_unmatched):
        print("指定された行フィルターに一致するCSV行がありません。Gemini呼び出しをスキップします。")
        return None

    data_rows = [row for _, row in indexed_rows]
    has_csv_targets = bool(indexed_rows) or bool(existing_matches)

    image_name = file_list.get("MAB_picture2")
    if not image_name:
        print("MAB画像ファイルが指定されていません。")
        return None

    image_path = Path(dir_name) / image_name
    if not image_path.exists():
        print(f"MAB画像が見つかりません: {image_path}")
        return None

    run_timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    # TODO
    run_dir = Path(f"{output_dir}job_{run_timestamp}")
    run_dir.mkdir(parents=True, exist_ok=True)

    if csv_text:
        (run_dir / "input_csv.txt").write_text(csv_text, encoding="utf-8")
    _write_json_file(run_dir / "input_rows.json", data_rows)

    metadata: Dict[str, object] = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "image_path": str(image_path),
        "has_csv_targets": has_csv_targets,
        "csv_row_count": original_row_count,
        "target_row_count": len(indexed_rows),
        "max_gemini_retries": MAX_GEMINI_RETRIES,
    }
    if target_row_set is not None:
        metadata["target_row_indices"] = sorted(target_row_set)
    if existing_matches:
        metadata["reused_match_count"] = len(existing_matches)
    if carryover_unmatched:
        metadata["reused_unmatched_count"] = len(carryover_unmatched)
    if normalized_row_tile_regions:
        metadata["row_tile_region_count"] = len(normalized_row_tile_regions)
        metadata["row_tile_region_padding"] = region_padding_px
    _write_json_file(run_dir / "metadata.json", metadata)
    if normalized_row_tile_regions:
        _write_json_file(
            run_dir / "row_tile_regions.json",
            {str(idx): _serialize_tile_row_context(entry) for idx, entry
             in normalized_row_tile_regions.items()},
        )

    try:
        (
          aggregated_tokens,
          raw_tokens,
          paragraphs,
          image_size
        ) = _load_mab_tokens(image_path)
    except Exception as exc:
        print(f"MABのOCR取得に失敗しました: {exc}")
        _write_json_file(run_dir / "ocr_error.json", {"message": str(exc)})
        return None

    if not aggregated_tokens:
        if not raw_tokens:
            print("OCRで取得できたトークンがありません。")
            _write_json_file(
                run_dir / "ocr_error.json", {"message": "no_tokens"})
            return None
        aggregated_tokens = [
            AggregatedToken(
                token_id=f"raw_{token.token_id}",
                text=token.text,
                rect=token.rect,
                paragraph_id=token.paragraph_id or "__none__",
                source_ids=[token.token_id],
            )
            for token in raw_tokens
        ]

    _write_json_file(
        run_dir / "ocr_raw_tokens.json",
        [
            {
                "id": token.token_id,
                "text": token.text,
                "rect": {
                    "min_x": token.rect[0],
                    "min_y": token.rect[1],
                    "max_x": token.rect[2],
                    "max_y": token.rect[3],
                },
                "paragraph_id": token.paragraph_id,
            }
            for token in raw_tokens
        ],
    )
    _write_json_file(
        run_dir / "ocr_paragraphs.json",
        [
            {
                "id": paragraph.paragraph_id,
                "text": paragraph.text,
                "rect": {
                    "min_x": paragraph.rect[0],
                    "min_y": paragraph.rect[1],
                    "max_x": paragraph.rect[2],
                    "max_y": paragraph.rect[3],
                },
            }
            for paragraph in paragraphs
        ],
    )
    _write_json_file(
        run_dir / "ocr_aggregated_tokens.json",
        [asdict(token) for token in aggregated_tokens],
    )

    token_lookup: Dict[str, OCRToken] = {
            token.token_id: token for token in raw_tokens}

    used_source_ids: set = set()
    row_logs: Dict[int, List[str]] = defaultdict(list)
    row_failure_reasons: Dict[int, List[str]] = defaultdict(list)
    unmatched_entries: List[Dict[str, object]] = list(carryover_unmatched)
    final_matches: List[Dict[str, object]] = []
    new_matches: List[Dict[str, object]] = []

    if existing_matches:
        for match in existing_matches:
            for key in ("source_token_ids", "token_ids"):
                token_ids = []
                if isinstance(match, dict):
                    token_ids = match.get(key, [])
                if not isinstance(token_ids, list):
                    continue
                for token_id in token_ids:
                    if token_id is None:
                        continue
                    used_source_ids.add(str(token_id))
            row_index_value = None
            if isinstance(match, dict):
                row_index_value = match.get("row_index")
            if isinstance(row_index_value, int):
                existing_logs = None
                if isinstance(match, dict):
                    existing_logs = match.get("error_logs")
                if isinstance(existing_logs, list):
                    for log_path in existing_logs:
                        row_logs[row_index_value].append(str(log_path))
            match.setdefault("carried_over", True)
            final_matches.append(match)

    for entry in unmatched_entries:
        entry.setdefault("carried_over", True)

    def _remove_unmatched(row_idx: int) -> None:
        for index in range(len(unmatched_entries) - 1, -1, -1):
            if unmatched_entries[index].get("row_index") == row_idx:
                unmatched_entries.pop(index)

    def _record_unmatched(row_idx: int, row: List[str], reason: str) -> None:
        _remove_unmatched(row_idx)
        entry = {
            "row_index": row_idx,
            "row": row,
            "reason": reason,
            "error_logs": list(dict.fromkeys(row_logs.get(row_idx, []))),
        }
        tile_context = normalized_row_tile_regions.get(row_idx)
        if tile_context:
            entry["tile_context"] = _serialize_tile_row_context(tile_context)
        entry["carried_over"] = False
        unmatched_entries.append(entry)

    if has_csv_targets:
        for row_idx, row in indexed_rows:
            query_text = _build_dimension_query(row)
            if not query_text:
                row_failure_reasons[row_idx].append("empty_query")
                _record_unmatched(row_idx, row, "empty_query")
                continue

            available_raw_tokens = [
                token for token in raw_tokens
                if str(token.token_id) not in used_source_ids
            ]
            if not available_raw_tokens:
                row_failure_reasons[row_idx].append("no_available_tokens")
                _record_unmatched(row_idx, row, "no_available_tokens")
                continue

            region_info = normalized_row_tile_regions.get(row_idx)
            region_rect = region_info.get("rect") if region_info else None
            if region_rect:
                region_tokens = _filter_tokens_by_rect(
                    available_raw_tokens,
                    region_rect,
                    padding=region_padding_px,
                    image_size=image_size,
                )
                if not region_tokens:
                    reason = "no_tokens_in_tile_region"
                    row_failure_reasons[row_idx].append(reason)
                    _record_unmatched(row_idx, row, reason)
                    continue
                available_raw_tokens = region_tokens

            available_paragraph_ids = {
                token.paragraph_id for token in available_raw_tokens
                if token.paragraph_id
            }
            filtered_paragraphs = paragraphs
            if region_rect:
                region_paragraphs = _filter_paragraphs_by_rect(
                    paragraphs,
                    region_rect,
                    padding=region_padding_px,
                    image_size=image_size,
                )
                if region_paragraphs:
                    filtered_paragraphs = region_paragraphs
            if available_paragraph_ids:
                paragraph_subset = [
                    paragraph for paragraph in filtered_paragraphs
                    if paragraph.paragraph_id in available_paragraph_ids
                ]
                if paragraph_subset:
                    filtered_paragraphs = paragraph_subset

            matched = False
            for attempt in range(1, MAX_GEMINI_RETRIES + 1):
                llm_matches, log_paths = _call_gemini_for_dimension_match(
                    filtered_paragraphs,
                    available_raw_tokens,
                    image_path,
                    query_text,
                    log_dir=run_dir,
                    row_index=row_idx,
                    attempt=attempt,
                )
                for path in log_paths:
                    row_logs[row_idx].append(str(path))

                if not llm_matches:
                    row_failure_reasons[row_idx].append(
                            f"attempt_{attempt}_no_match")
                    continue

                selected_llm: Optional[Dict[str, object]] = None
                selected_raw_ids: List[str] = []
                for candidate in llm_matches:
                    raw_ids = [
                        tid
                        for tid in candidate.get("token_ids", [])
                        if tid in token_lookup and tid not in used_source_ids
                    ]
                    if raw_ids:
                        selected_llm = candidate
                        selected_raw_ids = raw_ids
                        break

                if not selected_llm or not selected_raw_ids:
                    row_failure_reasons[row_idx].append(
                            f"attempt_{attempt}_no_available_tokens")
                    continue

                raw_tokens_for_match = [
                        token_lookup[tid] for tid in selected_raw_ids]
                rect = _union_token_rects(raw_tokens_for_match)
                matched_text = " ".join(
                    token_lookup[tid].text for tid in selected_raw_ids
                    if token_lookup[tid].text
                )
                log_refs = list(dict.fromkeys(row_logs.get(row_idx, [])))
                candidate_entry = {
                    "row_index": row_idx,
                    "row": row,
                    "rect": rect,
                    "token_ids": list(selected_raw_ids),
                    "source_token_ids": list(selected_raw_ids),
                    "matched_text": matched_text,
                    "llm_summary": selected_llm.get("summary"),
                    "llm_confidence": selected_llm.get("confidence"),
                    "llm_reason": selected_llm.get("reason"),
                    "match_source": "gemini",
                    "attempt": attempt,
                    "error_logs": log_refs,
                }
                tile_context = normalized_row_tile_regions.get(row_idx)
                if tile_context:
                    candidate_entry[
                            "tile_context"
                    ] = _serialize_tile_row_context(
                            tile_context)
                candidate_entry["carried_over"] = False
                _remove_unmatched(row_idx)
                final_matches.append(candidate_entry)
                new_matches.append(candidate_entry)
                used_source_ids.update(selected_raw_ids)
                matched = True
                break

            if not matched:
                reasons = row_failure_reasons.get(row_idx) or ["unmatched"]
                _record_unmatched(row_idx, row, " / ".join(reasons))
    else:
        if csv_text:
            print("CSVの解析に失敗したため、OCR寸法候補をハイライトします。")
        else:
            print("CSVが提供されていないため、OCR寸法候補をハイライトします。")
        final_matches = _matches_from_dimension_tokens(aggregated_tokens)
        for match in final_matches:
            match.setdefault("error_logs", [])

    total_rows = len(indexed_rows)
    new_match_count = len(new_matches)
    metadata.update(
        {
            "llm_match_count": len(final_matches),
            "new_llm_match_count": new_match_count,
            "unmatched_count": len(unmatched_entries),
            "image_size": image_size,
        }
    )
    _write_json_file(run_dir / "metadata.json", metadata)
    _write_json_file(run_dir / "row_logs.json", {str(idx): logs for idx, logs
                                                 in row_logs.items()})
    _write_json_file(run_dir / "row_failure_reasons.json", {
        str(idx): reasons for idx, reasons in row_failure_reasons.items()})

    if has_csv_targets:
        if total_rows == 0:
            print("今回は新たに処理するCSV行がありません。既存の結果を再利用して出力します。")
        else:
            print(f"LLMマッチ件数: {new_match_count}/{total_rows}")
            if new_match_count == total_rows:
                print("全てのCSV行がLLMでマッチしました。demission_group内のCSVを正とみなします。")
            else:
                print("未マッチ行があります。ログを確認してください。")
        print(f"ログ出力ディレクトリ: {run_dir}")

    if not final_matches and has_csv_targets:
        if unmatched_entries:
            _write_json_file(
                    run_dir / "unmatched_entries.json", unmatched_entries)
            unmatched_csv_path = _export_unmatched_csv(
                    image_path,
                    unmatched_entries,
                    output_dir
                    )
            if unmatched_csv_path:
                print(f"未マッチ行をCSVに出力しました: {unmatched_csv_path}")
            print("Geminiでのマッチが得られませんでした。未マッチ一覧を確認してください。")
        return None

    ordered_matches = sorted(
        final_matches,
        key=lambda entry: (
            entry.get("row_index") is None,
            entry.get("row_index", float("inf")),
        ),
    )

    _write_json_file(run_dir / "final_matches.json", ordered_matches)
    _write_json_file(run_dir / "unmatched_entries.json", unmatched_entries)

    annotated_path = _annotate_matches(
        image_path,
        ordered_matches,
        suffix="_annotated_dims_llm_final",
        outline=(220, 20, 60),
        output_dir=output_dir,
        box_on=box_on
    )

    print("=== 寸法マッチ結果 ===")
    for display_idx, match in enumerate(ordered_matches, start=1):
        source_label = match.get("match_source", "gemini")
        group_ids = match.get("token_ids")
        source_ids = match.get("source_token_ids")
        rect = match.get("rect")
        text = match.get("matched_text")
        query_value = _primary_dimension_text(match.get("row") or [])
        query_suffix = f" query='{query_value}'" if query_value else ""
        mes1 = f"No.{display_idx}"
        mes1 += f"row#{match.get('row_index')}: "
        mes1 += f"source={source_label}{query_suffix} "
        mes2 = f"tokens={group_ids} sources={source_ids} "
        mes2 += f"rect={rect} text='{text}'"
        print(mes1, mes2)
        if match.get("llm_summary"):
            print(f"    summary: {match['llm_summary']}")
        if match.get("llm_confidence") is not None:
            print(f"    confidence: {match['llm_confidence']}")
        if match.get("llm_reason"):
            print(f"    reason: {match['llm_reason']}")

    if annotated_path:
        print(f"ハイライト画像を保存しました: {annotated_path}")

    csv_output_path = _export_matches_csv(
        image_path,
        ordered_matches,
        filename_suffix="_matched_dimensions_llm_final",
        output_dir=output_dir
    )
    if csv_output_path:
        print(f"マッチ結果をCSVに出力しました: {csv_output_path}")

    unmatched_csv_path = _export_unmatched_csv(
            image_path,
            unmatched_entries,
            output_dir)
    if unmatched_csv_path:
        print(f"未マッチ行をCSVに出力しました: {unmatched_csv_path}")

    if unmatched_entries:
        print("未マッチの行:")
        for entry in sorted(
                unmatched_entries, key=lambda item: item.get("row_index", 0)):
            row_idx = entry.get("row_index")
            row = entry.get("row") or []
            query_value = _primary_dimension_text(row)
            query_suffix = f" query='{query_value}'" if query_value else ""
            reason_text = entry.get("reason") or ""
            log_text = ",".join(entry.get("error_logs", []))
            log_suffix = f" logs=[{log_text}]" if log_text else ""
            mes = f"  row#{row_idx}:{query_suffix} "
            mes += f"reason={reason_text}{log_suffix} row={row}"
            print(mes)

    return run_dir


def replay_dimension_run(
        log_dir: Union[str, Path],
        output_dir) -> None:
    log_dir = Path(log_dir)
    if not log_dir.exists() or not log_dir.is_dir():
        print(f"ログディレクトリが存在しません: {log_dir}")
        return

    metadata_path = log_dir / "metadata.json"
    rows_path = log_dir / "input_rows.json"
    if not metadata_path.exists() or not rows_path.exists():
        print("metadata.json または input_rows.json が見つかりません。")
        return

    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"metadata.json の読み込みに失敗しました: {exc}")
        return

    image_path_value = metadata.get("image_path")
    if not image_path_value:
        print("metadata.json に image_path がありません。")
        return

    image_path = Path(image_path_value)
    if not image_path.exists():
        print(f"ログに記録された画像が見つかりません: {image_path}")
        return

    csv_text_path = log_dir / "input_csv.txt"
    if csv_text_path.exists():
        csv_payload = csv_text_path.read_text(encoding="utf-8")
    else:
        try:
            rows = json.loads(rows_path.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"input_rows.json の読み込みに失敗しました: {exc}")
            return
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["項目", "寸法値または品質指定等の記載内容", "備考"])
        writer.writerows(rows)
        csv_payload = buffer.getvalue()

    dir_name = str(image_path.parent)
    file_list = {"MAB_picture2": image_path.name}

    target_rows: Optional[List[int]] = None
    target_row_set: Optional[set[int]] = None
    reuse_unmatched_payload: Optional[List[Dict[str, object]]] = None
    unmatched_path = log_dir / "unmatched_entries.json"
    if unmatched_path.exists():
        try:
            raw_unmatched = json.loads(
                    unmatched_path.read_text(encoding="utf-8"))
            if isinstance(raw_unmatched, list):
                filtered_unmatched: List[Dict[str, object]] = [
                    entry for entry in raw_unmatched
                    if isinstance(entry, dict)
                ]
                target_candidates: List[int] = []
                for entry in filtered_unmatched:
                    row_idx_value = entry.get("row_index")
                    try:
                        row_idx_int = None
                        if row_idx_value is not None:
                            row_idx_int = int(row_idx_value)
                    except (TypeError, ValueError):
                        row_idx_int = None
                    if row_idx_int is not None:
                        target_candidates.append(row_idx_int)
                target_row_set = set(target_candidates)
                if target_candidates:
                    target_rows = sorted(target_row_set)
                else:
                    target_rows = []

                reuse_unmatched: List[Dict[str, object]] = []
                for entry in filtered_unmatched:
                    row_idx_value = entry.get("row_index")
                    try:
                        row_idx_int = None
                        if row_idx_value is not None:
                            row_idx_int = int(row_idx_value)
                    except (TypeError, ValueError):
                        row_idx_int = None
                    if (
                            target_row_set and row_idx_int is not None and
                            row_idx_int in target_row_set):
                        continue
                    reuse_unmatched.append(entry)
                if reuse_unmatched:
                    reuse_unmatched_payload = reuse_unmatched
        except Exception as exc:
            print(f"unmatched_entries.json の読み込みに失敗しました: {exc}")

    reuse_matches_payload: Optional[List[Dict[str, object]]] = None
    final_matches_path = log_dir / "final_matches.json"
    if final_matches_path.exists():
        try:
            raw_matches = json.loads(
                    final_matches_path.read_text(encoding="utf-8"))
            if isinstance(raw_matches, list):
                reuse_candidates: List[Dict[str, object]] = []
                for entry in raw_matches:
                    if not isinstance(entry, dict):
                        continue
                    row_idx_value = entry.get("row_index")
                    try:
                        row_idx_int = None
                        if row_idx_value is not None:
                            row_idx_int = int(row_idx_value)
                    except (TypeError, ValueError):
                        row_idx_int = None
                    if (
                            target_row_set and row_idx_int is not None and
                            row_idx_int in target_row_set):
                        continue
                    reuse_candidates.append(entry)
                if reuse_candidates:
                    reuse_matches_payload = reuse_candidates
        except Exception as exc:
            print(f"final_matches.json の読み込みに失敗しました: {exc}")

    row_tile_regions_payload: Optional[Dict[str, object]] = None
    row_tile_regions_path = log_dir / "row_tile_regions.json"
    if row_tile_regions_path.exists():
        try:
            loaded_tile_regions = json.loads(
                    row_tile_regions_path.read_text(encoding="utf-8"))
            if isinstance(loaded_tile_regions, dict):
                row_tile_regions_payload = loaded_tile_regions
        except Exception as exc:
            print(f"row_tile_regions.json の読み込みに失敗しました: {exc}")

    if target_rows is None:
        print(f"ログ {log_dir} を再実行します (全行対象)。")
    elif target_rows:
        print(
            f"ログ {log_dir} を再実行します (未マッチ行のみ対象: {target_rows})."
        )
    else:
        print(f"ログ {log_dir} を再実行します (既存結果の再利用のみ)。")

    region_padding = metadata.get("row_tile_region_padding")
    try:
        region_padding_int = 20
        if region_padding is not None:
            region_padding_int = int(region_padding)
    except (TypeError, ValueError):
        region_padding_int = 20

    highlight_mab_dimensions(
        dir_name,
        file_list,
        csv_payload,
        target_row_indices=target_rows,
        reuse_matches=reuse_matches_payload,
        reuse_unmatched_entries=reuse_unmatched_payload,
        row_tile_regions=row_tile_regions_payload,
        region_padding_px=region_padding_int,
        output_dir=output_dir
    )


def demission_group(
    dir_name,
    file_list: Dict,
    output_dir,
    *,
    tile_dir: Optional[str] = None,
    tile_tolerance: float = 1e-3,
    tile_max_results: int = 1,
    tile_region_padding: int = 30,
    box_on: bool = True
):
    # 投影図すべてに囲みました。
    if _gemini_manager is None:
        print("Geminiモデルが利用できないため、demission_groupをスキップします。")
        return

    MAB_compare_prompt = f"""
        添付した画像の{file_list['MAB_picture1']}について、投影図ごとに対称性や特徴(横幅や縦幅等、複数類似する値があればどこのどのような値か・図面の配置等)について調べて
            
            ルール
            1:JSON形式でにて出力してください。
                "view_part": "正面図"・"注記欄"等,//どの投影図もしくは図以外の設計指示が含まれてるパートを、必ず一つだけ表題については触れなくてよい
                "feture":"最大横幅は3.8",// 図面に関する特徴的な情報を簡潔に記載。
                "notice": ”関連する断面図あり”,//他の寸法との関係性がわかる形で、図面内でどのような寸法の値かを記載。
                "view_part": "側面図",//以下投影図図ごとに値を作成...
            2:出力はjson形式のみにしてください
        """
    raw_MAB_compare_res = _gemini_generate(
        image_paths=[f"{dir_name}{file_list['MAB_picture1']}"],
        prompts=[MAB_compare_prompt],
    )
    error_message = _extract_error(raw_MAB_compare_res)
    if error_message:
        print(f"MAB_compare_resの取得でエラーが発生しました: {error_message}")
        sys.exit(1)
    MAB_compare_res = get_raw_response(raw_MAB_compare_res)
    tile_dir_path: Optional[Path] = None
    if tile_dir:
        candidate = Path(tile_dir)
        if not candidate.is_absolute():
            candidate = Path(dir_name) / candidate
        tile_dir_path = candidate

    csv_payload: Optional[str] = None
    row_tile_regions_payload: Optional[Dict[int, Dict[str, object]]] = None

    highlight_image_path = Path(dir_name) / file_list["MAB_picture2"]
    if tile_dir_path and highlight_image_path.exists():
        tile_regions = _detect_tile_regions(
            highlight_image_path,
            tile_dir_path,
            tolerance=tile_tolerance,
            max_results=tile_max_results,
        )
        if tile_regions:
            tile_rows, row_tile_map = _generate_tile_dimension_rows(
                tile_regions,
                original_name=file_list["MAB_picture1"],
                compare_summary=MAB_compare_res,
            )
            if tile_rows:
                csv_payload = _rows_to_csv(tile_rows)
                row_tile_regions_payload = row_tile_map
    elif tile_dir_path:
        print(f"タイルディレクトリは指定されていますが画像が見つかりません: {highlight_image_path}")

    if not csv_payload:
        if tile_dir_path:
            print("タイルベースの寸法抽出に失敗したため、全体画像からリストを生成します。")
        MAB_list_prompt = f"""
        図面の{file_list['MAB_picture1']}に含まれている寸法の値や品質指定について、記載されているすべてを表形式にて一覧化してください。
        囲まれた部分は投影図です。囲まれた部分すべてについて囲んでください。

        図面の特徴情報
        {MAB_compare_res}

        ルール
        1:表のカラムは、"項目","寸法値または品質指定等の記載内容","備考"の3項目で抽出してください
            項目記載例:どのような投影図か、管理番号がある場合は管理番号も記載
            寸法値・品質指定記載例:"4× R0.3","18× R44.4±0.18","3× 20.3±0.08"//注記の場合は記載されてる内容はここで記載
            備考欄記載例:どのような寸法の値か記載。また、"※"印がある場合、対応する注記の記載内容を記載
        2:CSV形式でにて出力してください。
        3:CSV形式以外出力しないでください
    """
        raw_MAB_csvres = _gemini_generate(
            image_paths=[f"{dir_name}{file_list['MAB_picture1']}"],
            prompts=[MAB_list_prompt],
        )
        error_message = _extract_error(raw_MAB_csvres)
        if error_message:
            print(f"MAB_csvresの取得でエラーが発生しました: {error_message}")
            return
        csv_payload = get_raw_response(raw_MAB_csvres)

    print_csv_payload = csv_payload.encode(sys.stdout.encoding)
    print(f"社内出力:\n{print_csv_payload}")

    effective_padding = max(0, int(tile_region_padding))
    highlight_mab_dimensions(
        dir_name,
        file_list,
        csv_payload,
        row_tile_regions=row_tile_regions_payload,
        region_padding_px=effective_padding,
        output_dir=output_dir,
        box_on=box_on
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="図面比較ユーティリティ")
    parser.add_argument(
            "--replay-log",
            type=str,
            help="過去のログディレクトリを指定すると再実行します")
    parser.add_argument(
            "--dir",
            type=str,
            default="input_image/02-564XA/", help="画像ディレクトリのパス")
    parser.add_argument(
            "--mab-picture1",
            type=str,
            default="customer_draw_viewssquare.jpg",
            help="MAB画像(LLM入力用)のファイル名")
    parser.add_argument(
            "--mab-picture2",
            type=str,
            default="customer_draw.jpeg",
            help="MAB画像(ハイライト用)のファイル名")
    parser.add_argument(
            "--output-dir",
            type=str,
            default="output/",
            help="実行結果出力先ディレクトリ")
    parser.add_argument(
            "--box-enable",
            action='store_true',
            help="出力画像の設計項目に赤枠をつける")
    parser.add_argument(
            "--tile-dir",
            type=str,
            default="cut/",
            help="テンプレートマッチング用のタイル画像ディレクトリ")
    parser.add_argument(
            "--tile-tolerance",
            type=float,
            default=1e-2,
            help="テンプレートマッチングの許容差")
    parser.add_argument(
            "--tile-max-results",
            type=int, default=1,
            help="タイルごとの最大検出数 (0で無制限)")
    parser.add_argument(
        "--tile-region-padding",
        type=int,
        default=30,
        help="タイル矩形を使ってOCRトークンを抽出する際のパディング(px)",
    )
    args = parser.parse_args()

    if args.replay_log:
        replay_dimension_run(
            args.replay_log,
            args.output_dir
        )
        sys.exit(0)

    dir_name = args.dir
    if dir_name and not dir_name.endswith((os.sep, "/")):
        dir_name = dir_name + os.sep
    file_list: Dict[str, str] = {}
    file_list["MAB_picture1"] = args.mab_picture1
    file_list["MAB_picture2"] = args.mab_picture2

    print(f"********** {args.box_enable} ************************")
    demission_group(
        dir_name,
        file_list,
        tile_dir=args.tile_dir,
        tile_tolerance=args.tile_tolerance,
        tile_max_results=args.tile_max_results,
        tile_region_padding=args.tile_region_padding,
        output_dir=args.output_dir,
        box_on=args.box_enable
    )
    sys.exit(0)
