import cv2 as cv
import sys
import numpy as np


def pad_to_same_size(img1, img2):
    h1, w1 = img1.shape[:2]
    h2, w2 = img2.shape[:2]
    H = max(h1, h2)
    W = max(w1, w2)

    def pad(img, H, W):
        h, w = img.shape[:2]
        top = (H - h) // 2
        bottom = H - h - top
        left = (W - w)
        right = W - w - left
        # 画像の上下左右に白い余白を追加
        return cv.copyMakeBorder(
                img,
                top,
                bottom,
                left,
                right,
                cv.BORDER_CONSTANT,
                value=[255, 255, 255])
    return pad(img1, H, W), pad(img2, H, W)


# 画像の差分を検出し、差分領域の黒字部分を赤くして保存する関数
def highlight_diff(img1_filename, img2_filename):
    print("ハイライト開始")
    # 画像ファイルの読み込み（JPEG形式）
    img1 = cv.imread(img1_filename)
    img2 = cv.imread(img2_filename)

    # グレースケール変換
    gray1 = cv.cvtColor(img1, cv.COLOR_BGR2GRAY)
    gray2 = cv.cvtColor(img2, cv.COLOR_BGR2GRAY)

    # 差分画像の作成
    diff = cv.absdiff(gray1, gray2)
    # 差分画像を2値化
    _, diff_bin = cv.threshold(diff, 30, 255, cv.THRESH_BINARY)

    # 差分領域の輪郭を抽出
    contours, _ = cv.findContours(
            diff_bin, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    # 元画像をコピーして差分領域の黒字部分を赤く塗る
    img1_marked = img1.copy()
    img2_marked = img2.copy()
    for cnt in contours:
        area = cv.contourArea(cnt)
        if area < 50:  # ノイズ除去（小さい領域は無視）
            continue
        x, y, w, h = cv.boundingRect(cnt)
        # 差分領域のマスク作成
        mask = np.zeros(gray1.shape, dtype=np.uint8)
        cv.drawContours(mask, [cnt], -1, 255, -1)
        mask_roi = mask[y:y+h, x:x+w]
        # ROIを抽出
        roi1 = img1_marked[y:y+h, x:x+w]
        roi2 = img2_marked[y:y+h, x:x+w]
        # 黒字部分（暗い画素）を赤に（閾値80は調整可）
        black_pixels1 = (
                cv.cvtColor(roi1, cv.COLOR_BGR2GRAY) < 50) & (mask_roi == 255)
        black_pixels2 = (
                cv.cvtColor(roi2, cv.COLOR_BGR2GRAY) < 50) & (mask_roi == 255)
        roi1[black_pixels1] = [0, 0, 255]
        roi2[black_pixels2] = [0, 0, 255]
        img1_marked[y:y+h, x:x+w] = roi1
        img2_marked[y:y+h, x:x+w] = roi2

    print("ハイライト終了")

    return img1_marked, img2_marked


def main(args):
    img_1 = cv.imread(args[1])
    img_2 = cv.imread(args[2])

    # サイズを揃える
    img_1_h, img_1_w = img_1.shape[:2]
    img_2_h, img_2_w = img_2.shape[:2]
    print(f"img_1 shape({img_1_w}, {img_1_h})")
    print(f"img_2 shape({img_2_w}, {img_2_h})")

    img_1_re_moved = img_1.copy()
    img_2_re_moved = img_2.copy()

    min_h = min(img_1_h, img_2_h)
    min_w = min(img_1_w, img_2_w)

    img_r_1 = img_1[0:min_h, 0:min_w]
    img_r_2 = img_2[0:min_h, 0:min_w]

    gray_1 = cv.cvtColor(img_r_1, cv.COLOR_BGR2GRAY).astype(np.float32)
    gray_2 = cv.cvtColor(img_r_2, cv.COLOR_BGR2GRAY).astype(np.float32)

    cv.imwrite(
            f"{args[1].split('.')[0]}_move_check_1_before.jpeg",
            gray_1)
    cv.imwrite(
            f"{args[2].split('.')[0]}_move_check_2_before.jpeg",
            gray_2)
    (x, y), r = cv.phaseCorrelate(gray_1, gray_2)
    print(f"({x}, {y}), {r}")

    h_1, w_1 = gray_1.shape[:2]
    h_2, w_2 = gray_2.shape[:2]

    M = np.float32([[1, 0, -x], [0, 1, -y]])
    img_1_moved = gray_1
    img_2_moved = cv.warpAffine(gray_2, M, (w_2, h_2))

    cv.imwrite(
            f"{args[1].split('.')[0]}_move_check_1_after.jpeg",
            img_1_moved)
    cv.imwrite(
            f"{args[2].split('.')[0]}_move_check_2_after.jpeg",
            img_2_moved)

    img_1_hl, img_2_hl = highlight_diff(
            f"{args[1].split('.')[0]}_move_check_1_after.jpeg",
            f"{args[2].split('.')[0]}_move_check_2_after.jpeg",
    )
    hl_1_h, hl_1_w = img_1_hl.shape[:2]
    hl_2_h, hl_2_w = img_2_hl.shape[:2]

    print(f"hl img_1 shape({hl_1_w}, {hl_1_h})")
    print(f"hl img_2 shape({hl_2_w}, {hl_2_h})")

    re_M = np.float32([[1, 0, x], [0, 1, y]])

    img_1_re_moved = cv.copyMakeBorder(
            img_1_hl,
            0,
            abs(hl_1_h - img_1_h),
            0,
            abs(hl_1_w - img_1_w),
            cv.BORDER_CONSTANT,
            value=[255, 255, 255]
    )
    img_2_af_moved = cv.warpAffine(img_2_hl, re_M, (hl_2_w, hl_2_h))
    img_2_re_moved = cv.copyMakeBorder(
            img_2_af_moved,
            0,
            abs(hl_2_h - img_2_af_moved.shape[0]),
            0,
            abs(hl_2_w - img_2_af_moved.shape[1]),
            cv.BORDER_CONSTANT,
            value=[255, 255, 255]
    )
    img_1_re_h, img_1_re_w = img_1_re_moved.shape[:2]
    img_2_re_h, img_2_re_w = img_2_re_moved.shape[:2]
    print(f"re moved img1 hl shape({img_1_re_w}, {img_1_re_h})")
    print(f"re moved img2 hl shape({img_2_re_w}, {img_2_re_h})")
    cv.imwrite(
            f"{args[1].split('.')[0]}_highlight.jpeg",
            img_1_re_moved)
    cv.imwrite(
            f"{args[2].split('.')[0]}_hightlight.jpeg",
            img_2_re_moved)


if __name__ == '__main__':
    main(sys.argv)
