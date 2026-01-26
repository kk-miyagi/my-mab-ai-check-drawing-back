from google import genai
from google.genai import types as genai_types
from pathlib import Path
import os
import json
from typing import List, Optional

DEFAULT_PROJECT = os.environ.get("VERTEX_PROJECT") or os.environ.get("VERTEXAI_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT") or "mab-ai-adv-util"
DEFAULT_LOCATION = os.environ.get("VERTEX_LOCATION", "us-central1")
DEFAULT_MODEL_NAME = os.environ.get("VERTEX_MODEL", "gemini-2.5-pro")


def _build_genai_client() -> genai.Client:
    """Create a genai client configured for Vertex AI."""
    return genai.Client(vertexai=True, project=DEFAULT_PROJECT, location=DEFAULT_LOCATION)


_GENAI_CLIENT = _build_genai_client()


def get_default_client() -> genai.Client:
    """Expose the lazily created default genai client."""
    return _GENAI_CLIENT

# JSON抽出ユーティリティ（テキスト中のJSONだけを抜き出してパース）
def extract_first_json(text: str):
    # 文字列全体がJSON
    try:
        return json.loads(text)
    except Exception:
        pass

    import re
    # ```json ... ``` / ``` ... ``` のフェンス内を優先
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fence:
        snippet = fence.group(1).strip()
        try:
            return json.loads(snippet)
        except Exception:
            pass

    # 最初の整合の取れた {..} or [..] をスキャン
    def find_balanced_region(s: str, start: int) -> int:
        open_ch = s[start]
        close_ch = '}' if open_ch == '{' else ']'
        depth = 0
        in_str = False
        esc = False
        for i in range(start, len(s)):
            c = s[i]
            if in_str:
                if esc:
                    esc = False
                elif c == '\\':
                    esc = True
                elif c == '"':
                    in_str = False
                continue
            else:
                if c == '"':
                    in_str = True
                elif c == open_ch:
                    depth += 1
                elif c == close_ch:
                    depth -= 1
                    if depth == 0:
                        return i
        return -1

    for i, ch in enumerate(text):
        if ch in "{[":
            end = find_balanced_region(text, i)
            if end != -1:
                candidate = text[i:end+1]
                try:
                    return json.loads(candidate)
                except Exception:
                    continue

    return None

def get_image_files(directory: str) -> List[str]:
    """指定ディレクトリから画像ファイルの一覧を取得"""
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    image_files = []
    
    if os.path.exists(directory):
        for file in os.listdir(directory):
            if any(file.lower().endswith(ext) for ext in image_extensions):
                image_files.append(os.path.join(directory, file))
    
    return sorted(image_files)

def load_image_as_part(image_path: str) -> Optional[genai_types.Part]:
    """画像ファイルをVertex AI用のPartオブジェクトに変換"""
    try:
        with open(image_path, "rb") as f:
            image_data = f.read()
        
        # ファイル拡張子から MIME タイプを決定
        file_extension = Path(image_path).suffix.lower()
        if file_extension in ['.jpg', '.jpeg']:
            mime_type = "image/jpeg"
        elif file_extension == '.png':
            mime_type = "image/png"
        elif file_extension == '.gif':
            mime_type = "image/gif"
        elif file_extension == '.webp':
            mime_type = "image/webp"
        else:
            raise ValueError(f"Unsupported image format: {file_extension}")
        
        return genai_types.Part.from_bytes(data=image_data, mime_type=mime_type)
    except FileNotFoundError:
        print(f"❌ エラー: 画像ファイル '{image_path}' が見つかりません。")
        return None
    
def load_pdf_as_part(image_path: str) -> Optional[genai_types.Part]:
    """PDFファイルをVertex AI用のPartオブジェクトに変換"""
    try:
        with open(image_path, "rb") as f:
            pdf_data = f.read()
        mime_type = "application/pdf"
        return genai_types.Part.from_bytes(data=pdf_data, mime_type=mime_type)
    except FileNotFoundError:
        print(f"❌ エラー: PDFファイル '{image_path}' が見つかりません。")
        return None

def generate_with_multiple_contents(
    model_or_client=None,
    *,
    prompts: Optional[List[str]] = None,
    image_paths: Optional[List[str]] = None,
    pdf_paths: Optional[List[str]] = None,
    parts: Optional[List[genai_types.Part]] = None,
    stream: bool = False,
    generation_config=None,
    safety_settings=None,
    model_name: Optional[str] = None,
):
    """複数のコンテンツ（テキスト、画像、PDF、Part）を1リクエストでモデルに渡して推論する"""
    resolved_client = None
    resolved_model_name = model_name or DEFAULT_MODEL_NAME

    if isinstance(model_or_client, genai.Client):
        resolved_client = model_or_client
    elif isinstance(model_or_client, str):
        resolved_model_name = model_or_client
    elif model_or_client is not None:
        legacy_name = getattr(model_or_client, "model_name", None) or getattr(model_or_client, "_model_name", None)
        if isinstance(legacy_name, str) and legacy_name.strip():
            resolved_model_name = legacy_name.strip()

    if resolved_client is None:
        resolved_client = _GENAI_CLIENT
    contents = []

    # 追加する順序は与えられた順番を尊重
    if prompts:
        for p in prompts:
            if isinstance(p, str) and p.strip():
                contents.append(p)

    if image_paths:
        for p in image_paths:
            part = load_image_as_part(p)
            if part:
                contents.append(part)

    if pdf_paths:
        for p in pdf_paths:
            part = load_pdf_as_part(p)
            if part:
                contents.append(part)

    if parts:
        for prt in parts:
            if isinstance(prt, genai_types.Part):
                contents.append(prt)

    if not contents:
        raise ValueError("コンテンツが空です。prompts/image_paths/pdf_paths/parts のいずれかを指定してください。")

    kwargs = {}
    if generation_config is not None:
        kwargs["config"] = generation_config
    if safety_settings is not None:
        kwargs["safety_settings"] = safety_settings

    try:
        if stream:
            text_out = []
            for chunk in resolved_client.models.generate_content_stream(
                model=resolved_model_name,
                contents=contents,
                **kwargs,
            ):
                if getattr(chunk, "text", None):
                    text_out.append(chunk.text)
            full_text = "".join(text_out)
            try:
                return json.loads(full_text)
            except Exception:
                extracted = extract_first_json(full_text)
                if extracted is not None:
                    return extracted
                return {"raw_response": full_text}
        else:
            resp = resolved_client.models.generate_content(
                model=resolved_model_name,
                contents=contents,
                **kwargs,
            )

            # ---- 安全なテキスト抽出（複数パート / 複数候補対応）----
            combined_text = ""
            # まずは従来の resp.text を試す（SDK が単一パートをまとめてくれるケース）
            try:
                combined_text = resp.text  # ここで今回のような例外が出ることがある
            except Exception:
                pass  # 失敗しても後続の手動結合にフォールバック

            if not combined_text:
                # candidates -> content -> parts を辿って text を結合
                try:
                    if hasattr(resp, "candidates") and resp.candidates:
                        part_texts = []
                        for cand in resp.candidates:
                            content_obj = getattr(cand, "content", None)
                            if not content_obj:
                                continue
                            parts = getattr(content_obj, "parts", [])
                            for p in parts:
                                t = getattr(p, "text", None)
                                if t:
                                    part_texts.append(t)
                        combined_text = "\n\n".join(part_texts)
                except Exception as inner_e:
                    return {"error": f"Failed to extract text parts: {inner_e}"}

            if not combined_text:
                # ここまでで何も取れなければレスポンス構造を返す
                return {"error": "Empty response text (no parts)", "raw_response_repr": repr(resp)}

            # ---- JSONパース & フォールバック ----
            txt = combined_text
            try:
                return json.loads(txt)
            except Exception:
                extracted = extract_first_json(txt)
                if extracted is not None:
                    return extracted
                return {"raw_response": txt}
    except Exception as e:
        return {"error": str(e)}





