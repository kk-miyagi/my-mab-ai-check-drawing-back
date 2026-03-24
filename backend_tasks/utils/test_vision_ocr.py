import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import math
import imghdr
from google.cloud import vision
from google.cloud.vision_v1.types import TextAnnotation
from PIL import Image, ImageDraw

from utils.dimension_models import OCRParagraph, OCRToken

try:
    from vertexai.generative_models import GenerativeModel
except ImportError:  # pragma: no cover - optional dependency
    GenerativeModel = None  # type: ignore

try:
    from simple_multi_genemipronpt import generate_with_multiple_contents, extract_first_json
except ImportError:  # pragma: no cover - optional dependency
    generate_with_multiple_contents = None  # type: ignore
    extract_first_json = None  # type: ignore

# サービスアカウントキーファイルのパスを設定
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'mab-ai-check-drawing-sa-key.json'

client = vision.ImageAnnotatorClient()

def perform_document_text_detection(
    image_path: Path,
    *,
    annotator_client: Optional[vision.ImageAnnotatorClient] = None,
) -> vision.AnnotateImageResponse:
    """指定した画像パスに対して Document Text Detection を実行し、レスポンスを返す。"""
    if not image_path.exists():
        raise FileNotFoundError(f"画像が見つかりません: {image_path.resolve()}")

    content = image_path.read_bytes()
    print(f"読込サイズ: {len(content)} bytes, パス: {image_path.resolve()}")

    kind = imghdr.what(None, h=content)
    if not kind:
        raise ValueError("画像ヘッダが不正です（Bad image data）。ファイル破損や拡張子と実体の不一致が疑われます。")

    client_to_use = annotator_client or client
    image = vision.Image(content=content)
    response = client_to_use.document_text_detection(image=image)

    if response.error.message:
        raise RuntimeError(response.error.message)

    return response


def _bounding_poly_to_points(bounding_poly, image_size: Tuple[int, int]) -> List[Tuple[int, int]]:
    """Vision APIのBoundingPolyをPillow描画用のポイント配列へ変換する"""
    if not bounding_poly:
        return []

    raw_vertices = list(getattr(bounding_poly, "vertices", []) or [])
    points: List[Tuple[int, int]] = []

    if raw_vertices:
        for vertex in raw_vertices:
            x = int(vertex.x) if getattr(vertex, "x", None) is not None else 0
            y = int(vertex.y) if getattr(vertex, "y", None) is not None else 0
            points.append((x, y))
    else:
        normalized = list(getattr(bounding_poly, "normalized_vertices", []) or [])
        if not normalized:
            return []
        width, height = image_size
        for vertex in normalized:
            x_val = int((getattr(vertex, "x", 0.0) or 0.0) * width)
            y_val = int((getattr(vertex, "y", 0.0) or 0.0) * height)
            points.append((x_val, y_val))

    return points


def _bounding_poly_to_rect(bounding_poly, image_size: Tuple[int, int]) -> Optional[Tuple[int, int, int, int]]:
    points = _bounding_poly_to_points(bounding_poly, image_size)
    if len(points) < 2:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def _rect_to_points(rect: Tuple[int, int, int, int], padding: int = 0, image_size: Optional[Tuple[int, int]] = None) -> List[Tuple[int, int]]:
    min_x, min_y, max_x, max_y = rect
    if padding and image_size:
        img_w, img_h = image_size
        min_x = max(min_x - padding, 0)
        min_y = max(min_y - padding, 0)
        max_x = min(max_x + padding, img_w - 1)
        max_y = min(max_y + padding, img_h - 1)

    return [
        (min_x, min_y),
        (max_x, min_y),
        (max_x, max_y),
        (min_x, max_y),
    ]


def _union_rect(rects: List[Tuple[int, int, int, int]]) -> Optional[Tuple[int, int, int, int]]:
    valid_rects = [r for r in rects if r]
    if not valid_rects:
        return None
    min_x = min(r[0] for r in valid_rects)
    min_y = min(r[1] for r in valid_rects)
    max_x = max(r[2] for r in valid_rects)
    max_y = max(r[3] for r in valid_rects)
    return min_x, min_y, max_x, max_y


def _rect_area(rect: Tuple[int, int, int, int]) -> int:
    min_x, min_y, max_x, max_y = rect
    return max(0, max_x - min_x) * max(0, max_y - min_y)


def _intersection_over_union(rect_a: Tuple[int, int, int, int], rect_b: Tuple[int, int, int, int]) -> float:
    ax1, ay1, ax2, ay2 = rect_a
    bx1, by1, bx2, by2 = rect_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
    if inter_area == 0:
        return 0.0

    area_a = _rect_area(rect_a)
    area_b = _rect_area(rect_b)
    union_area = area_a + area_b - inter_area
    if union_area <= 0:
        return 0.0
    return inter_area / union_area


def _filter_overlapping_groups(
    groups: List[Dict[str, object]],
    token_lookup: Dict[str, OCRToken],
    image_size: Tuple[int, int],
    *,
    token_overlap_ratio: float = 0.3, # 既に採用済みのグループと「トークンIDの重なり」がこの割合を超える候補は破棄。小さくすると“同じトークンの再利用”に厳しくなり、重複が減るが見落としが増えます。
    iou_threshold: float = 0.5, # 採用済みグループの矩形と候補矩形の IoU がこの閾値を超えると破棄。小さくすると矩形の重なりに厳しくなり、オーバーラップが減る。大きくすると許容。
    max_width_ratio: float = 0.40, # 候補グループの結合矩形の幅が画像幅に対してこの比率を超えると除外（トークンが2個以上のグループのみ適用）。
    max_height_ratio: float = 0.40, # 候補グループの結合矩形の幅が画像幅に対してこの比率を超えると除外（トークンが2個以上のグループのみ適用）。
    max_diagonal_ratio: float = 0.60, # 結合矩形の対角長が画像の対角長に対してこの比率を超えると除外（2トークン以上）。画像全体をまたぐような“遠すぎる/広すぎる”塊を抑制します。
) -> List[Dict[str, object]]:
    prepared: List[Dict[str, object]] = []
    for group in groups:
        raw_token_ids = group.get("token_ids", [])
        if not isinstance(raw_token_ids, list):
            continue
        token_ids = [tid for tid in raw_token_ids if tid in token_lookup]
        if not token_ids:
            continue
        rects = [token_lookup[tid].rect for tid in token_ids]
        union_rect = _union_rect(rects)
        if not union_rect:
            continue
        width = max(0, union_rect[2] - union_rect[0])
        height = max(0, union_rect[3] - union_rect[1])
        diag = math.hypot(width, height)
        img_w, img_h = image_size
        if img_w and width / img_w > max_width_ratio and len(token_ids) > 1:
            continue
        if img_h and height / img_h > max_height_ratio and len(token_ids) > 1:
            continue
        if (img_w or img_h) and len(token_ids) > 1:
            max_dim = math.hypot(img_w, img_h) if img_w and img_h else max(img_w, img_h)
            if max_dim and diag / max_dim > max_diagonal_ratio:
                continue
        prepared.append({
            "group": group,
            "token_ids": token_ids,
            "rect": union_rect,
            "area": _rect_area(union_rect),
        })

    prepared.sort(key=lambda item: (-len(item["token_ids"]), item["area"]))

    filtered: List[Dict[str, object]] = []
    used_tokens: set[str] = set()

    for candidate in prepared:
        token_ids = candidate["token_ids"]
        overlap_count = sum(1 for tid in token_ids if tid in used_tokens)
        if token_ids and overlap_count / len(token_ids) > token_overlap_ratio:
            continue

        skip_due_to_iou = False
        for kept in filtered:
            if _intersection_over_union(candidate["rect"], kept["rect"]) > iou_threshold:
                skip_due_to_iou = True
                break
        if skip_due_to_iou:
            continue

        filtered.append(candidate)
        used_tokens.update(token_ids)

    return [
        {
            "label": item["group"].get("label", "Group"),
            "token_ids": item["token_ids"],
            "confidence": item["group"].get("confidence"),
            "notes": item["group"].get("notes"),
            "rect": item["rect"],
        }
        for item in filtered
    ]


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 2:
            lines = lines[1:]
            while lines and lines[-1].strip() == "```":
                lines.pop()
            return "\n".join(lines)
    return text


def _extract_paragraphs_and_tokens(full_text_annotation, image_size: Tuple[int, int]) -> Tuple[List[OCRParagraph], List[OCRToken]]:
    if not getattr(full_text_annotation, "pages", None):
        return [], []

    break_map = {
        TextAnnotation.DetectedBreak.BreakType.SPACE: " ",
        TextAnnotation.DetectedBreak.BreakType.SURE_SPACE: " ",
        TextAnnotation.DetectedBreak.BreakType.EOL_SURE_SPACE: "\n",
        TextAnnotation.DetectedBreak.BreakType.HYPHEN: "",
        TextAnnotation.DetectedBreak.BreakType.LINE_BREAK: "\n",
    }

    paragraphs: List[OCRParagraph] = []
    tokens: List[OCRToken] = []
    paragraph_counter = 1
    token_counter = 1

    for page in full_text_annotation.pages:
        for block in getattr(page, "blocks", []):
            for paragraph in getattr(block, "paragraphs", []):
                paragraph_chars: List[str] = []
                paragraph_id = f"paragraph_{paragraph_counter}"

                for word in getattr(paragraph, "words", []):
                    word_chars: List[str] = []
                    for symbol in getattr(word, "symbols", []):
                        word_chars.append(symbol.text)
                        paragraph_chars.append(symbol.text)
                        detected_break = getattr(getattr(symbol, "property", None), "detected_break", None)
                        if detected_break:
                            br = break_map.get(detected_break.type)
                            if br is not None:
                                paragraph_chars.append(br)

                    word_text = "".join(word_chars).strip()
                    rect = _bounding_poly_to_rect(getattr(word, "bounding_box", None), image_size)
                    if word_text and rect:
                        token_id = f"token_{token_counter}"
                        tokens.append(OCRToken(token_id=token_id, text=word_text, rect=rect, paragraph_id=paragraph_id))
                        token_counter += 1

                paragraph_text = "".join(paragraph_chars).strip()
                rect = _bounding_poly_to_rect(getattr(paragraph, "bounding_box", None), image_size)
                if paragraph_text and rect:
                    paragraphs.append(OCRParagraph(paragraph_id=paragraph_id, text=paragraph_text, rect=rect))
                    paragraph_counter += 1

    return paragraphs, tokens


def _call_gemini_for_grouping(
    paragraphs: List[OCRParagraph],
    tokens: List[OCRToken],
    image_path: Path,
    model_name: str = "gemini-2.5-pro",
) -> Optional[List[Dict[str, object]]]:
    if not tokens:
        return None

    if generate_with_multiple_contents is None or GenerativeModel is None:
        print("Vertex AI SDK または補助関数が利用できないため連携をスキップします。")
        return None

    path_obj = Path(image_path)
    if not path_obj.exists():
        print(f"画像ファイルが見つかりません: {path_obj.resolve()}")
        return None

    try:
        model = GenerativeModel(model_name)
    except Exception as exc:  # pragma: no cover - network/api config
        print(f"Vertex AIモデルの初期化に失敗しました: {exc}")
        return None

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

    payload = {
        "tokens": tokens_payload,
        "paragraphs": paragraphs_payload,
        "instructions": "Group the OCR tokens that belong together semantically on the drawing (e.g., dimensions, titles, notes, identifiers). Return compact groups; keep groups focused on items that are physically close and conceptually related."
    }

    system_prompt = (
        "あなたは図面のOCR結果を意味のある塊にまとめるアシスタントです。"
        # f"図面{path_obj}を参考に、OCR結果であるJSON内の token.id を用いてグループを作成し、各グループに要約ラベルを付けてください。"
        "入力JSON内の token.id を用いてグループを作成し、各グループに要約ラベルを付けてください。"
        "注記の場合、複数の意味のある塊があるので、箇条書きがある場合はそれも考慮してください。"
        "設計上の指示を寸法値以外の言葉でする場合は、その下に英語で翻訳された指示が含まれることがあるため考慮して判断してください。"
        "必ず次のJSON形式で応答してください:\n"
        "{\n  \"groups\": [\n    {\n      \"label\": string,\n      \"token_ids\": [string, ...],\n      \"confidence\": number (0-1, optional),\n      \"notes\": string (optional)\n    }\n  ]\n}\n"
        "token_ids には存在するIDのみを使い、重複登録は避け、説明が難しい場合でも label は空ではなく簡潔に記述してください。"
    )

    payload_text = json.dumps(payload, ensure_ascii=False)

    try:
        result = generate_with_multiple_contents(
            model,
            # image_paths=[str(path_obj)],
            prompts=[system_prompt, f"INPUT_JSON:\n{payload_text}"],
        )
    except Exception as exc:  # pragma: no cover - network/api call
        print(f"Vertex AI呼び出しでエラーが発生しました: {exc}")
        return None

    data: Optional[Dict[str, object]] = None
    if isinstance(result, dict):
        if "raw_response" in result and extract_first_json is not None:
            parsed = extract_first_json(str(result.get("raw_response", "")))
            if isinstance(parsed, dict):
                data = parsed
            else:
                data = result
        else:
            data = result
    elif extract_first_json is not None:
        parsed = extract_first_json(str(result))
        if isinstance(parsed, dict):
            data = parsed

    if not isinstance(data, dict):
        print("Vertex AI応答を辞書として解釈できませんでした。")
        return None

    groups = data.get("groups") if isinstance(data, dict) else None
    if not isinstance(groups, list):
        print("Gemini応答に groups 配列が見つかりませんでした。")
        return None

    normalized_groups: List[Dict[str, object]] = []
    for group in groups:
        if not isinstance(group, dict):
            continue
        token_ids = group.get("token_ids") or group.get("tokens")
        if not isinstance(token_ids, list):
            continue
        valid_ids = [tid for tid in token_ids if isinstance(tid, str)]
        if not valid_ids:
            continue
        normalized_groups.append(
            {
                "label": str(group.get("label", "")) or "Group",
                "token_ids": valid_ids,
                "confidence": group.get("confidence"),
                "notes": group.get("notes"),
            }
        )

    if not normalized_groups:
        print("Gemini応答に有効なグループが含まれていませんでした。")
        return None

    return normalized_groups


def main():
    # パスのエスケープ問題を回避し、存在確認
    img_path = Path("input_image") / "TKE-162481_13_resized.jpeg"
    try:
        response = perform_document_text_detection(img_path)
    except FileNotFoundError as exc:
        print(str(exc))
        return
    except ValueError as exc:
        print(f"Error: {exc}")
        return
    except RuntimeError as exc:
        print(f"Error: {exc}")
        return

    print("=== OCR結果 ===")

    # full_text_annotation 優先、なければ text_annotations[0].description にフォールバック
    if getattr(response, "full_text_annotation", None) and response.full_text_annotation.text.strip():
        print(response.full_text_annotation.text)
    elif getattr(response, "text_annotations", None) and response.text_annotations:
        print(response.text_annotations[0].description)
    else:
        print("テキストは検出されませんでした。")

    # OCRで取得した文字領域を段落単位で赤枠描画
    annotated_path = img_path.with_name(f"{img_path.stem}_annotated{img_path.suffix}")
    try:
        base_image = Image.open(img_path).convert("RGB")
    except Exception as exc:
        print(f"注釈画像の読み込みに失敗しました: {exc}")
        return

    drawer = ImageDraw.Draw(base_image)
    image_size = base_image.size

    full_text_annotation = getattr(response, "full_text_annotation", None)
    paragraphs, tokens = _extract_paragraphs_and_tokens(full_text_annotation, image_size)
    token_lookup: Dict[str, OCRToken] = {token.token_id: token for token in tokens}
    drew_anything = False

    gemini_groups = _call_gemini_for_grouping(paragraphs, tokens, img_path)
    if gemini_groups:
        filtered_groups = _filter_overlapping_groups(gemini_groups, token_lookup, image_size)
        if filtered_groups:
            print("--- Geminiによる意味塊の描画 ---")
            for idx, group in enumerate(filtered_groups, start=1):
                token_ids = group.get("token_ids", [])
                union_rect = group.get("rect")
                if not union_rect:
                    continue
                points = _rect_to_points(union_rect, padding=4, image_size=image_size)
                drawer.line(points + [points[0]], fill="red", width=4)
                label = str(group.get("label", "Group"))
                preview_tokens = ", ".join(token_lookup[tid].text for tid in token_ids if tid in token_lookup)
                print(f"Gemini塊{idx}: '{label}' -> tokens={token_ids} -> {points}")
                if preview_tokens:
                    print(f"  内容: {preview_tokens[:120]}")
                try:
                    text_anchor = (points[0][0] + 4, max(points[0][1] - 18, 0))
                    drawer.text(text_anchor, label[:40], fill="red")
                except Exception:
                    pass
                drew_anything = True

    if not drew_anything and paragraphs:
        print("--- 段落単位の描画 ---")
        for idx, paragraph in enumerate(paragraphs, start=1):
            points = _rect_to_points(paragraph.rect, padding=4, image_size=image_size)
            drawer.line(points + [points[0]], fill="red", width=4)
            preview_text = paragraph.text.replace("\n", " ")[:60]
            print(f"段落{idx}: '{preview_text}' -> {points}")
            drew_anything = True

    if not drew_anything and tokens:
        print("段落・Geminiによる描画ができなかったため、単語単位で描画します。")
        for token in tokens:
            points = _rect_to_points(token.rect, padding=2, image_size=image_size)
            drawer.line(points + [points[0]], fill="red", width=3)
            print(f"単語: '{token.text}' -> {points}")
            drew_anything = True

    if not drew_anything:
        annotations = getattr(response, "text_annotations", None) or []
        for annotation in annotations[1:]:  # 先頭要素は全体の境界なので除外
            points = _bounding_poly_to_points(getattr(annotation, "bounding_poly", None), image_size)
            if len(points) < 2:
                continue
            drawer.line(points + [points[0]], fill="red", width=3)
            preview_text = annotation.description.replace("\n", " ")[:30]
            print(f"text_annotations フォールバック: '{preview_text}' -> {points}")
            drew_anything = True

    if drew_anything:
        base_image.save(annotated_path)
        print(f"赤枠付き画像を保存しました: {annotated_path.resolve()}")
    else:
        print("描画対象のテキストアノテーションがありませんでした。")

if __name__ == "__main__":
    main()