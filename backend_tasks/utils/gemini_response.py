"""Utilities for parsing and logging Gemini responses."""
import ast
import json
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent


def _json_safe(value: object) -> object:
    if isinstance(value, dict):
        return {str(key): _json_safe(val) for key, val in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    try:
        json.dumps(value)
        return value
    except TypeError:
        return repr(value)


def _write_json_file(path: Path, data: object) -> None:
    try:
        with path.open("w", encoding="utf-8") as fp:
            json.dump(_json_safe(data), fp, ensure_ascii=False, indent=2)
    except Exception as exc:  # pragma: no cover - logging helper should not raise
        with path.open("w", encoding="utf-8") as fp:
            fp.write(
                json.dumps(
                    {"error": str(exc), "fallback_repr": repr(data)},
                    ensure_ascii=False,
                    indent=2,
                )
            )


def _strip_code_fence(text: str) -> str:
    text = text or ""
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 2:
            inner = lines[1:]
            while inner and inner[-1].strip() == "```":
                inner.pop()
            return "\n".join(inner)
    return text


def _coerce_structured_response(raw_response):
    if isinstance(raw_response, list):
        return [_coerce_structured_response(item) for item in raw_response]
    if isinstance(raw_response, dict):
        return raw_response
    if not isinstance(raw_response, str):
        return raw_response

    content = raw_response.strip()
    if not content:
        return raw_response

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    try:
        return ast.literal_eval(content)
    except (ValueError, SyntaxError):
        pass

    if content.startswith("{") and content.endswith("}"):
        separators = ["}\n{", "}\r\n{", "}{", "}\t{"]
        for sep in separators:
            if sep in content:
                candidate = f"[{content.replace(sep, '},{')}]"
                try:
                    return ast.literal_eval(candidate)
                except (ValueError, SyntaxError):
                    continue
        candidate = f"[{content}]"
        try:
            return ast.literal_eval(candidate)
        except (ValueError, SyntaxError):
            return raw_response

    return raw_response


def _normalize_view_entries(views):
    if views is None:
        return []
    if isinstance(views, list):
        normalized: List[Dict] = []
        for item in views:
            normalized.extend(_normalize_view_entries(item))
        return normalized
    if isinstance(views, dict):
        return [views]

    coerced = _coerce_structured_response(views)
    if coerced is views:
        return []
    return _normalize_view_entries(coerced)


def extract_views(payload):
    def _collect(node):
        collected: List[Dict] = []
        if isinstance(node, dict):
            if "views" in node:
                collected.extend(_normalize_view_entries(node.get("views")))
            for key, value in node.items():
                if key == "views":
                    continue
                collected.extend(_collect(value))
        elif isinstance(node, list):
            for item in node:
                collected.extend(_collect(item))
        return collected

    return _collect(payload)


def _log_gemini_error(
    category: str,
    *,
    payload: Optional[Dict[str, object]] = None,
    prompts: Optional[List[str]] = None,
    response: object = None,
    exception: Optional[BaseException] = None,
    extra: Optional[Dict[str, object]] = None,
) -> Optional[Path]:
    try:
        log_dir = REPO_ROOT / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        now = datetime.now()
        timestamp = now.strftime("%Y%m%d_%H%M%S_%f")
        log_path = log_dir / f"gemini_error_{timestamp}.json"

        entry: Dict[str, object] = {
            "timestamp": now.isoformat(timespec="seconds"),
            "category": category,
        }
        if prompts is not None:
            entry["prompts"] = [_json_safe(item) for item in prompts]
        if payload is not None:
            entry["payload"] = _json_safe(payload)
        if response is not None:
            entry["response"] = _json_safe(response)
        if exception is not None:
            entry["exception"] = {
                "type": type(exception).__name__,
                "message": str(exception),
                "traceback": "".join(
                    traceback.format_exception(exception.__class__, exception, exception.__traceback__)
                ),
            }
        if extra:
            entry["context"] = _json_safe(extra)

        with log_path.open("w", encoding="utf-8") as fp:
            json.dump(entry, fp, ensure_ascii=False, indent=2)

        print(f"Geminiエラーログを出力しました: {log_path}")
        return log_path
    except Exception as log_exc:  # pragma: no cover - best effort logging
        print(f"Geminiエラーログの書き込みに失敗しました: {log_exc}")
    return None


def get_raw_response(data):
    if isinstance(data, str):
        try:
            parsed = json.loads(data)
        except json.JSONDecodeError:
            parsed = data
    else:
        parsed = data

    if isinstance(parsed, dict):
        if "raw_response" in parsed:
            return _coerce_structured_response(parsed["raw_response"])
        return _coerce_structured_response(parsed)

    return _coerce_structured_response(parsed)
