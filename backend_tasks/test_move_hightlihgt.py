import cv2 as cv
import sys
import numpy as np


# 画像の差分を検出し、差分領域の黒字部分を赤くして保存する関数
def highlight_diff(img1_filename, img2_filename):
    print("ハイライト開始")
    # 画像ファイルの読み込み（JPEG形式）
    img1 = cv.imread(img1_filename)
    img2 = cv.imread(img2_filename)
    # サイズを揃える
#   img1, img2 = pad_to_same_size(img1, img2)
    img1 = cv.resize(img1, (img2.shape[1], img2.shape[0]))
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
                cv.cvtColor(roi1, cv.COLOR_BGR2GRAY) < 80) & (mask_roi == 255)
        black_pixels2 = (
                cv.cvtColor(roi2, cv.COLOR_BGR2GRAY) < 80) & (mask_roi == 255)
        roi1[black_pixels1] = [0, 0, 255]
        roi2[black_pixels2] = [0, 0, 255]
        img1_marked[y:y+h, x:x+w] = roi1
        img2_marked[y:y+h, x:x+w] = roi2

    print("ハイライト終了")

    return img1_marked, img2_marked


def main(args):
    img_1 = cv.imread(args[1])
    img_2 = cv.imread(args[2])

    area_1 = img_1.shape[0] * img_1.shape[1]
    area_2 = img_2.shape[0] * img_2.shape[1]

    if area_1 >= area_2:
        img_1 = cv.resize(img_1, (img_2.shape[1], img_2.shape[0]))
    else:
        img_2 = cv.resize(img_2, (img_1.shape[1], img_1.shape[0]))

    gray_1 = cv.cvtColor(img_1, cv.COLOR_BGR2GRAY).astype(np.float32)
    gray_2 = cv.cvtColor(img_2, cv.COLOR_BGR2GRAY).astype(np.float32)

    (x, y), r = cv.phaseCorrelate(gray_1, gray_2)
    print(f"({x}, {y}), {r}")

    h_1, w_1 = gray_1.shape[:2]

    if x < 0:
        x11, x12 = abs(int(x)), w_1
        x21, x22 = 0, w_1 - abs(int(x))
    else:
        x21, x22 = abs(int(x)), w_1
        x11, x12 = 0, w_1 - abs(int(x))

    if y < 0:
        y11, y12 = abs(int(y)), h_1
        y21, y22 = 0, h_1 - abs(int(y))
    else:
        y21, y22 = abs(int(y)), h_1
        y11, y12 = 0, h_1 - abs(int(y))

    img_1_moved = cv.convertScaleAbs(gray_1[y11:y12, x11:x12])
    img_2_moved = cv.convertScaleAbs(gray_2[y21:y22, x21:x22])
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
    cv.imwrite(
            f"{args[1].split('.')[0]}_highlight.jpeg",
            img_1_hl)
    cv.imwrite(
            f"{args[2].split('.')[0]}_hightlight.jpeg",
            img_2_hl)


if __name__ == '__main__':
    main(sys.argv)
