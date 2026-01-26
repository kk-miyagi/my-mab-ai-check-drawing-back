"""Locate exact sub-images inside a larger reference image using template matching.

This module exposes both a library API (`locate_tiles`) and a CLI for quick
experiments. It assumes the tile images were cropped directly from the original,
so a simple template-matching pass with a very low tolerance is sufficient.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

import numpy as np

try:
    import cv2  # type: ignore
except ImportError as exc:  # pragma: no cover - optional dependency guard
    raise ImportError(
        "opencv-python is required for template matching. "
        "Install it with `pip install opencv-python`."
    ) from exc


@dataclass(frozen=True)
class MatchResult:
    """Single match location."""

    x: int
    y: int
    width: int
    height: int
    score: float

    @property
    def bottom_right(self) -> tuple[int, int]:
        return self.x + self.width, self.y + self.height


def _read_grayscale(path: Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if image is None:  # pragma: no cover - defensive guard
        raise FileNotFoundError(f"Unable to read image: {path}")
    return image


def _suppress_region(matrix: np.ndarray, loc: tuple[int, int], tile_shape: tuple[int, int]) -> None:
    """Suppress already-used area to avoid duplicate detections."""

    y, x = loc[1], loc[0]
    tile_h, tile_w = tile_shape
    row_end = min(matrix.shape[0], y + tile_h)
    col_end = min(matrix.shape[1], x + tile_w)
    matrix[y:row_end, x:col_end] = 1.0  # worst score for TM_SQDIFF_NORMED


def _match_single(
    original: np.ndarray,
    tile: np.ndarray,
    tolerance: float,
    max_results: int,
) -> List[MatchResult]:
    if tile.shape[0] > original.shape[0] or tile.shape[1] > original.shape[1]:
        raise ValueError("Tile is larger than the original image")

    result = cv2.matchTemplate(original, tile, cv2.TM_SQDIFF_NORMED)
    matches: List[MatchResult] = []
    search = result.copy()

    while True:
        min_val, _max_val, min_loc, _max_loc = cv2.minMaxLoc(search)
        if min_val > tolerance:
            break
        x, y = min_loc
        score = max(0.0, 1.0 - float(min_val))
        matches.append(MatchResult(x=x, y=y, width=tile.shape[1], height=tile.shape[0], score=score))
        if 0 < max_results == len(matches):
            break
        _suppress_region(search, min_loc, tile.shape)

    return matches


def locate_tiles(
    original_path: Path,
    tile_paths: Sequence[Path],
    tolerance: float = 1e-4,
    max_results: int = 1,
) -> dict[Path, List[MatchResult]]:
    """Locate each tile inside the original image."""

    original = _read_grayscale(original_path)
    results: dict[Path, List[MatchResult]] = {}

    for tile_path in tile_paths:
        tile = _read_grayscale(tile_path)
        matches = _match_single(original, tile, tolerance=tolerance, max_results=max_results)
        results[tile_path] = matches

    return results


def _match_to_dict(match: MatchResult) -> dict[str, object]:
    bx, by = match.bottom_right
    return {
        "x": match.x,
        "y": match.y,
        "width": match.width,
        "height": match.height,
        "bottom_right": {"x": bx, "y": by},
        "score": match.score,
    }


_COLOR_PALETTE: Tuple[Tuple[int, int, int], ...] = (
    (0, 255, 0),
    (255, 0, 0),
    (0, 0, 255),
    (0, 255, 255),
    (255, 0, 255),
    (255, 255, 0),
)


def _annotate_original(
    original_path: Path,
    annotations: List[Tuple[str, MatchResult]],
    output_path: Path,
) -> None:
    image = cv2.imread(str(original_path), cv2.IMREAD_COLOR)
    if image is None:  # pragma: no cover - defensive guard
        raise FileNotFoundError(f"Unable to read image for annotation: {original_path}")

    for idx, (tile_label, match) in enumerate(annotations):
        color = _COLOR_PALETTE[idx % len(_COLOR_PALETTE)]
        pt1 = (match.x, match.y)
        pt2 = match.bottom_right
        cv2.rectangle(image, pt1, pt2, color, 2)
        label = Path(tile_label).stem
        cv2.putText(
            image,
            label,
            (match.x, max(0, match.y - 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            color,
            1,
            cv2.LINE_AA,
        )

    if not cv2.imwrite(str(output_path)):
        raise IOError(f"Failed to save debug image to {output_path}")


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Locate tiles inside an original image.")
    parser.add_argument("original", type=Path, help="Path to the original (full) image")
    parser.add_argument(
        "tiles",
        type=Path,
        nargs="+",
        help="One or more tile images that were cropped from the original",
    )
    parser.add_argument(
        "--tolerance",
        type=float,
        default=1e-4,
        help="Maximum normalized difference allowed for a match (default: 1e-4)",
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=1,
        help="Maximum matches per tile (use 0 for unlimited)",
    )
    parser.add_argument(
        "--debug-output",
        type=Path,
        help="Optional path to save the original image annotated with match rectangles",
    )
    return parser


def _main(argv: Iterable[str] | None = None) -> int:
    parser = _build_arg_parser()
    args = parser.parse_args(argv)

    matches_by_tile = locate_tiles(
        original_path=args.original,
        tile_paths=args.tiles,
        tolerance=args.tolerance,
        max_results=args.max_results,
    )

    json_payload: List[dict[str, object]] = []
    annotations: List[Tuple[str, MatchResult]] = []
    for tile_path, matches in matches_by_tile.items():
        if not matches:
            continue
        json_payload.append(
            {
                "tile": str(tile_path),
                "matches": [_match_to_dict(match) for match in matches],
            }
        )
        annotations.extend((str(tile_path), match) for match in matches)

    if json_payload:
        print(json.dumps(json_payload, ensure_ascii=False, indent=2))
        if args.debug_output:
            _annotate_original(args.original, annotations, args.debug_output)

    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(_main())
