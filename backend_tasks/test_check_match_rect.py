import sys
import json
import cv2
from PIL import Image, ImageDraw
from utils.image_operation import get_red_area


def get_output_rect(json_path: str) -> list[list]:
    """jsonからrectのみの配列を返す"""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    rects = [i["rect"] for i in data]
    return rects


def calc_iou(box_1: list, box_2: list) -> float:
    """矩形のIoUを計算"""
    x1 = max(box_1[0], box_2[0])
    y1 = max(box_1[1], box_2[1])
    x2 = min(box_1[2], box_2[2])
    y2 = min(box_1[3], box_2[3])

    inter_area = max(0, x2 - x1) * max(0, y2 - y1)

    box_area_1 = (box_1[2] - box_1[0]) * (box_1[3] - box_1[1])
    box_area_2 = (box_2[2] - box_2[0]) * (box_2[3] - box_2[1])

    denominator = float(box_area_1 + box_area_2 - inter_area)

    if denominator == 0:
        return 0.0
    iou = inter_area / denominator
    return iou


def modify_image(image_path: str, json_path: str) -> str:
    """矩形の上部にある文字を削除し、新しい画像を保存"""
    rects = get_output_rect(json_path)

    out_image_path = "test_image/tmp_modify_image_0.jpg"

    with Image.open(image_path).convert("RGB") as img:
        drawer = ImageDraw.Draw(img)

        # 文字の高さ(今のプログラムが40っぽいので40にしている)
        text_h = 40

        for i in rects:
            x1, y1, x2, y2 = i[0], i[1], i[2], i[3]
            h = y2 - y1
            y1 = y1 - text_h
            y2 = y2 - h
            drawer.rectangle((x1, y1, x2+5, y2), fill=(255, 255, 255))

        img.save(out_image_path)

    return out_image_path


def check_match_rect(image_path: str, json_path: str):
    tmp_image_path = modify_image(image_path, json_path)

    img = cv2.imread(tmp_image_path)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # 赤色のHSV
    mask = cv2.inRange(
            hsv,
            *get_red_area())
    cv2.imwrite("test_image/tmp_modify_image_1.jpg", mask)
    contours, _ = cv2.findContours(
            mask,
            cv2.RETR_LIST,
            cv2.CHAIN_APPROX_SIMPLE)

#   max_area = img.shape[0] * img.shape[1] * 0.5

    detected_boxes = []
    for cnt in contours:
        epsilon = 0.02 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)

        if len(approx) == 4 and cv2.isContourConvex(approx):
            area = cv2.contourArea(cnt)
            approx_area = cv2.contourArea(approx)
            # 四角のみを判定
#           if 30 < area < max_area:
            if area / approx_area < 1.05:
                x, y, w, h = cv2.boundingRect(approx)
                detected_boxes.append((x, y, x + w, y + h))
                cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 1)

    cv2.imwrite("test_image/tmp_modify_image_2.jpg", img)

    unique_detected_boxes = []
    for i in detected_boxes:
        for j in detected_boxes:
            if i == j:
                continue
            if abs(i[0] - j[0]) <= 5 and abs(i[3] - j[3]) <= 5:
                if j[3] > i[3]:
                    unique_detected_boxes.append(j)
                else:
                    unique_detected_boxes.append(i)
    unique_detected_boxes = list(set(unique_detected_boxes))

    rects = get_output_rect(json_path)
    print(f"画像から取得した数: {len(unique_detected_boxes)}")
    print(f"jsonのrect数: {len(rects)}")

    print("-- 比較 --")

    match_list = []
    unmatch_list = []
    for d_box in unique_detected_boxes:
        iou_list = []
        for j_rect in rects:
            iou = calc_iou(j_rect, d_box)
            iou_list.append((iou, j_rect))
        max_iou, _ = max(iou_list, key=lambda t: t[0])
        if max_iou > 0.9:
            match_list.append(d_box)
        else:
            unmatch_list.append(d_box)

    print(f"一致数: {len(match_list)}")
    print(f"不一致数: {len(unmatch_list)}")

    return match_list, unmatch_list


if __name__ == "__main__":
    # 第一引数が画像、第二引数がfinal_matches.jsonファイル
    check_match_rect(
        sys.argv[1],
        sys.argv[2]
    )
