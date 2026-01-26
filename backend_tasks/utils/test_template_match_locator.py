"""Run template matching on sample data under utils/input_image.

This script loads every original drawing from utils/input_image/old and tries to
locate its corresponding cut tiles stored in utils/input_image/cut. Any matches
are printed as JSON, and debug images with rectangles are saved under
utils/input_image/debug_output.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

import cv2  # type: ignore

from template_match_locator import locate_tiles, MatchResult

DATA_ROOT = Path(__file__).parent / "input_image"
ORIGINAL_DIR = DATA_ROOT / "old"
CUT_DIR = DATA_ROOT / "cut"
DEBUG_DIR = DATA_ROOT / "debug_output"
IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff")
COLOR_PALETTE: Tuple[Tuple[int, int, int], ...] = (
    (0, 255, 0),
    (255, 0, 0),
    (0, 0, 255),
    (0, 255, 255),
    (255, 0, 255),
    (255, 255, 0),
)
DEFAULT_TOLERANCE = 1e-2

def _list_images(directory: Path) -> List[Path]:
    files: List[Path] = []
    for extension in IMAGE_EXTENSIONS:
        files.extend(directory.glob(f"*{extension}"))
    return sorted(files)


def _matching_tiles(original_path: Path) -> List[Path]:
    prefix = original_path.stem
    tiles: List[Path] = []
    for extension in IMAGE_EXTENSIONS:
        tiles.extend(CUT_DIR.glob(f"{prefix}_*{extension}"))
    return sorted(set(tiles))


def _match_to_dict(match: MatchResult) -> Dict[str, object]:
    br_x, br_y = match.bottom_right
    return {
        "x": match.x,
        "y": match.y,
        "width": match.width,
        "height": match.height,
        "bottom_right": {"x": br_x, "y": br_y},
        "score": match.score,
    }


def _draw_debug_image(
    original_path: Path,
    matches_by_tile: Dict[Path, List[MatchResult]],
    output_path: Path,
) -> None:
    debug_image = cv2.imread(str(original_path), cv2.IMREAD_COLOR)
    if debug_image is None:
        raise FileNotFoundError(f"Unable to read image for debug overlay: {original_path}")

    color_index = 0
    for tile_path, matches in matches_by_tile.items():
        for match in matches:
            color = COLOR_PALETTE[color_index % len(COLOR_PALETTE)]
            color_index += 1
            cv2.rectangle(debug_image, (match.x, match.y), match.bottom_right, color, 2)
            label = Path(tile_path).stem
            text_origin = (match.x, max(0, match.y - 6))
            cv2.putText(
                debug_image,
                label,
                text_origin,
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                color,
                1,
                cv2.LINE_AA,
            )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output_path), debug_image):
        raise IOError(f"Failed to save debug image: {output_path}")


def _serialize_matches(matches_by_tile: Dict[Path, List[MatchResult]]) -> List[Dict[str, object]]:
    payload: List[Dict[str, object]] = []
    for tile_path, matches in matches_by_tile.items():
        if not matches:
            continue
        payload.append(
            {
                "tile": str(tile_path),
                "matches": [_match_to_dict(match) for match in matches],
            }
        )
    return payload


def main() -> None:
    originals = _list_images(ORIGINAL_DIR)
    if not originals:
        raise FileNotFoundError(f"No originals found in {ORIGINAL_DIR}")

    results: List[Dict[str, object]] = []
    for original in originals:
        tiles = _matching_tiles(original)
        if not tiles:
            print(f"Skipping {original.name}: no matching tiles under {CUT_DIR}")
            continue
        matches_by_tile = locate_tiles(
            original_path=original,
            tile_paths=tiles,
            tolerance=DEFAULT_TOLERANCE,
            max_results=1,
        )
        serialized = _serialize_matches(matches_by_tile)
        if not serialized:
            print(f"No matches found for {original.name} (tolerance={DEFAULT_TOLERANCE})")
            continue
        debug_path = DEBUG_DIR / f"{original.stem}_debug.png"
        _draw_debug_image(original, matches_by_tile, debug_path)
        results.append(
            {
                "original": str(original),
                "debug_image": str(debug_path),
                "tiles": serialized,
            }
        )

    if results:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print("No matches detected across any originals. Consider relaxing tolerance or verifying tile files.")


if __name__ == "__main__":
    main()
