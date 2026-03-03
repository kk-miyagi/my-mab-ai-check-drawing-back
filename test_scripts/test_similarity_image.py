from __future__ import annotations
from PIL import Image
import imagehash
import cv2
import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional

def hash_similarity(dir_name,image_list):
    # 画像を読み込む
    
    image1 = Image.open(f"{dir_name}{image_list[0]}")
    image2 = Image.open(f"{dir_name}{image_list[1]}")

    # ハッシュ値を計算
    hash1 = imagehash.average_hash(image1)
    hash2 = imagehash.average_hash(image2)

    # 類似度を計算（ハミング距離）
    similarity = 1 - (hash1 - hash2) / len(hash1.hash)**2
    print(f"hash類似度: {similarity * 100:.2f}%")

def hist_similarity(dir_name,image_list):
    # 画像を読み込む
    image1 = cv2.imread(f"{dir_name}{image_list[0]}")
    image2 = cv2.imread(f"{dir_name}{image_list[1]}")

    # グレースケールに変換
    gray1 = cv2.cvtColor(image1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(image2, cv2.COLOR_BGR2GRAY)

    # ヒストグラムを計算
    hist1 = cv2.calcHist([gray1], [0], None, [256], [0, 256])
    hist2 = cv2.calcHist([gray2], [0], None, [256], [0, 256])

    # ヒストグラムの類似度を比較（コサイン類似度）
    similarity = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
    print(f"hist類似度: {similarity * 100:.2f}%")

def ssim_similarity(dir_name,image_list):
    image1 = cv2.imread(f"{dir_name}{image_list[0]}")
    image2 = cv2.imread(f"{dir_name}{image_list[1]}")

    if image1 is None:
        print(f"エラー: {dir_name}{image_list[0]} を読み込めませんでした")
        return
    if image2 is None:
        print(f"エラー: {dir_name}{image_list[1]} を読み込めませんでした")
        return

    # 画像のサイズを確認
    h1, w1 = image1.shape[:2]
    h2, w2 = image2.shape[:2]
    
    # サイズが異なる場合は、小さい方のサイズに合わせてリサイズ
    if h1 != h2 or w1 != w2:
        min_height = min(h1, h2)
        min_width = min(w1, w2)
        image1 = cv2.resize(image1, (min_width, min_height))
        image2 = cv2.resize(image2, (min_width, min_height))

    mssim, ssim = cv2.quality.QualitySSIM_compute(image1, image2)
    print(f"ssim類似度: {mssim[0] * 100:.2f}%")

@dataclass(frozen=True)
class ScoreRow:
    target: str
    candidate: str
    orb_avg_dist: Optional[float]
    orb_good: int
    orb_total: int
    akaze_avg_dist: Optional[float]
    akaze_good: int
    akaze_total: int

def _parse_size(text: str) -> tuple[int, int]:
    import argparse

    try:
        w_str, h_str = text.lower().replace(" ", "").split("x")
        w, h = int(w_str), int(h_str)
        if w <= 0 or h <= 0:
            raise ValueError
        return (w, h)
    except Exception as exc:
        raise argparse.ArgumentTypeError("--size は '200x200' の形式で指定してください") from exc

def _iter_images(img_dir: Path, exts: set[str]) -> Iterable[Path]:
    for p in sorted(img_dir.iterdir()):
        if not p.is_file():
            continue
        if p.suffix.lower() in exts:
            yield p

def _read_gray(path: Path, size: tuple[int, int]) -> Optional[Any]:
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None
    return cv2.resize(img, size)


def _avg_distance(matches) -> Optional[float]:
    if not matches:
        return None
    dist = [m.distance for m in matches if m is not None]
    if not dist:
        return None
    return float(sum(dist) / len(dist))


def _orb_score(img1, img2, nfeatures: int, ratio: float) -> tuple[Optional[float], int, int]:
    detector = cv2.ORB_create(nfeatures=nfeatures)
    _, des1 = detector.detectAndCompute(img1, None)
    _, des2 = detector.detectAndCompute(img2, None)
    if des1 is None or des2 is None:
        return (None, 0, 0)

    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    pairs = bf.knnMatch(des1, des2, k=2)
    good = []
    total = 0
    for m_n in pairs:
        if len(m_n) < 2:
            continue
        m, n = m_n
        total += 1
        if m.distance < ratio * n.distance:
            good.append(m)
    return (_avg_distance(good), len(good), total)


def _akaze_score(
    img1,
    img2,
    threshold: float,
    nOctaves: int,
    nOctaveLayers: int,
    ratio: float,
) -> tuple[Optional[float], int, int]:
    detector = cv2.AKAZE_create(
        threshold=threshold,
        nOctaves=nOctaves,
        nOctaveLayers=nOctaveLayers,
        descriptor_type=cv2.AKAZE_DESCRIPTOR_MLDB,
    )
    _, des1 = detector.detectAndCompute(img1, None)
    _, des2 = detector.detectAndCompute(img2, None)
    if des1 is None or des2 is None:
        return (None, 0, 0)

    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    pairs = bf.knnMatch(des1, des2, k=2)
    good = []
    total = 0
    for m_n in pairs:
        if len(m_n) < 2:
            continue
        m, n = m_n
        total += 1
        if m.distance < ratio * n.distance:
            good.append(m)
    return (_avg_distance(good), len(good), total)


def _sort_key(row: ScoreRow) -> tuple[float, float]:
    orb = row.orb_avg_dist if row.orb_avg_dist is not None else 1e9
    akz = row.akaze_avg_dist if row.akaze_avg_dist is not None else 1e9
    return (orb, akz)


def _write_csv(rows: list[ScoreRow], out_path: Path) -> None:
    import csv

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "target",
                "candidate",
                "orb_avg_dist",
                "orb_good",
                "orb_total",
                "akaze_avg_dist",
                "akaze_good",
                "akaze_total",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r.target,
                    r.candidate,
                    "" if r.orb_avg_dist is None else f"{r.orb_avg_dist:.6f}",
                    r.orb_good,
                    r.orb_total,
                    "" if r.akaze_avg_dist is None else f"{r.akaze_avg_dist:.6f}",
                    r.akaze_good,
                    r.akaze_total,
                ]
            )

def calc_image_similarity(
        base_image_path: str,
        target_image_dir: str,
        topk: int = 3,
        size = (200, 200),
        out_csv: str = None,
        orb_nfeatures: int = 1000,
        orb_ratio: float = 0.75,
        akaze_threshold: float = 0.0010,
        akaze_n_octaves: int = 4,
        akaze_n_octave_layers: int = 4,
        akaze_ratio: float = 0.75
        ):
    img_dir = Path(target_image_dir)

    if not img_dir.exists() or not img_dir.is_dir():
        raise SystemExit(f"--target-dir が存在しません: {img_dir}")

    exts = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}
    all_imgs = list(_iter_images(img_dir, exts))
    if not all_imgs:
        raise SystemExit(f"画像が見つかりません: {img_dir}")

    cache: dict[str, Any] = {}
    for p in all_imgs:
        img = _read_gray(p, size)
        if img is not None:
            cache[p.name] = img

    base_img = Path(base_image_path)
    cache_base_img = _read_gray(base_img, size)

    if not base_img.exists():
        raise SystemExit(f"画像が見つかりません")

    rows: list[ScoreRow] = []

    for cand_path in all_imgs:
        cand_name = cand_path.name

        cand_img = cache.get(cand_name)
        if cand_img is None:
            continue

        orb_avg, orb_good, orb_total = _orb_score(cache_base_img, cand_img, orb_nfeatures, orb_ratio)
        akz_avg, akz_good, akz_total = _akaze_score(
            cache_base_img,
            cand_img,
            akaze_threshold,
            akaze_n_octaves,
            akaze_n_octave_layers,
            akaze_ratio,
        )

        rows.append(
            ScoreRow(
                target=cache_base_img,
                candidate=cand_name,
                orb_avg_dist=orb_avg,
                orb_good=orb_good,
                orb_total=orb_total,
                akaze_avg_dist=akz_avg,
                akaze_good=akz_good,
                akaze_total=akz_total,
            )
        )

    subset = rows.copy()
    subset.sort(key=_sort_key)

    print("=" * 80)
    print(f"BASE: {base_image_path} TARGET_DIR: {target_image_dir}  (size={size[0]}x{size[1]})")
    print("※距離（avg_dist）は小さいほど類似と解釈")
    print("candidate\torb_avg_dist\torb_good/total\takaze_avg_dist\takaze_good/total")
    for r in subset[: max(1, int(topk))]:
        orb_s = "-" if r.orb_avg_dist is None else f"{r.orb_avg_dist:.2f}"
        akz_s = "-" if r.akaze_avg_dist is None else f"{r.akaze_avg_dist:.2f}"
        print(
            f"{r.candidate}\t{orb_s}\t{r.orb_good}/{r.orb_total}\t{akz_s}\t{r.akaze_good}/{r.akaze_total}"
        )

    if out_csv:
        out_path = Path(out_csv)
        _write_csv(sorted(rows, key=lambda x: (x.target, _sort_key(x))), out_path)
        print(f"CSV出力: {out_path}")

    print("完了")

    return subset
    

if __name__ == "__main__":
    # 実行確認用
    parser = argparse.ArgumentParser(description="ORB と AKAZE を同時に一括比較してスコア出力します")
    parser.add_argument("--base-image-path", required=True, help="基準側図面")
    parser.add_argument("--target-image-dir", required=True, help="比較側図面")
    args = parser.parse_args()
    calc_image_similarity(
        base_image_path = args.base_image_path,
        target_image_dir = args.target_image_dir,
    )
