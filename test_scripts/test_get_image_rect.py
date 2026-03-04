import cv2
import numpy as np
import sys
from pathlib import Path


def mask_red_labels(img, hsv):
    # ラベル付与のRGBをHSVへ変換
    rgb = np.uint8([[[220, 20, 60]]])
    target_hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)[0][0]
    target_hsv = np.array(target_hsv)
    tol_h, tol_s, tol_v = 20, 30, 200

    lower = np.array([max(target_hsv[0] - tol_h, 0),
                      max(target_hsv[1] - tol_s, 0),
                      max(target_hsv[2] - tol_v, 0)])
    upper = np.array([180, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower, upper)

    # 除去
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    expanded = cv2.dilate(mask, kernel, iterations=1)
    result = cv2.inpaint(img, expanded, inpaintRadius=1,
                         flags=cv2.INPAINT_TELEA)

    return result


def get_black_and_white_colors(img, hsv):

    # 黒色の範囲 (低明度)
    lower_black = np.array([0, 0, 0])
    upper_black = np.array([180, 255, 50])  # 明度(V)が低い部分を黒とみなす
    mask_black = cv2.inRange(hsv, lower_black, upper_black)

    # 白色の範囲 (低彩度 & 高明度)
    lower_white = np.array([0, 0, 200])
    upper_white = np.array([180, 50, 255])  # 彩度(S)が低く、明度(V)が高い部分を白とみなす
    mask_white = cv2.inRange(hsv, lower_white, upper_white)

    # 黒と白のマスクを結合
    mask_bw = cv2.bitwise_or(mask_black, mask_white)

    # 黒白以外のマスクを作成（反転）
    mask_color = cv2.bitwise_not(mask_bw)

    # マスクを適用して色部分を抽出
    result = cv2.bitwise_and(img, img, mask=mask_color)

    hs = result.T[0].flatten()
    ss = result.T[1].flatten()
    vs = result.T[2].flatten()
    tmp_values = np.array([20, 20, 20])
    return (np.array([hs.min(), ss.min(), vs.min()]) + tmp_values,
            np.array([hs.max(), ss.max(), vs.max()]) + tmp_values)

def to_box(x, y, w, h):
    return (x, y, x + w, y + h)  # (x1, y1, x2, y2)


def is_inside(a, b, inclusive=True):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    if inclusive:
        return bx1 <= ax1 and by1 <= ay1 and bx2 >= ax2 and by2 >= ay2
    else:
        return bx1 <  ax1 and by1 <  ay1 and bx2 >  ax2 and by2 >  ay2


def main(img_name):
    image = cv2.imread(img_name)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # 黒と白以外色の範囲を取得
    lower_color, upper_color = get_black_and_white_colors(image, hsv)
    print(f"lower:{lower_color}\n upper:{upper_color}")
    # 指定色のマスク作成
    mask = cv2.inRange(hsv, lower_color, upper_color)
    
    # result = cv2.bitwise_and(image, image, mask=mask)
    # tmp_file = Path(f"./test_image/20260304_test_1.jpg")
    # cv2.imwrite(tmp_file, result)

    # ノイズ除去
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)

    # 輪郭抽出
    contours, _ = cv2.findContours(
        mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    print(len(contours))

    if len(contours) == 0:
        print("指定色の四角形が見つかりませんでした。")
    else:
        print(f"contours size: {len(contours)}")

        # 画像の総面積
        img_height, img_width = image.shape[:2]
        img_total_area = img_width * img_height
        contours_list = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > img_total_area * 0.005:
                contours_list.append(cv2.boundingRect(cnt))
                x, y, w, h = cv2.boundingRect(cnt)

    boxes = [to_box(*r) for r in contours_list]

    # 内側の矩形だけを抽出
    inner_rects = []
    for i, a in enumerate(boxes):
        # どれか一つにでも内包されていれば内側とみなす
        if any(is_inside(a, boxes[j], inclusive=True) and j != i for j in range(len(boxes))):
            inner_rects.append(contours_list[i])
    # for c in inner_rects:
    #     x, y, w, h = c
    #     cv2.rectangle(image, (x, y), (x + w, y + h), (0, 255, 0), 1)
    # cv2.imwrite("./test_image/20260304_test_2.jpg", image)
    print(f"座標一覧: {inner_rects}")

    return inner_rects


if __name__ == '__main__':
    main(sys.argv[1])
