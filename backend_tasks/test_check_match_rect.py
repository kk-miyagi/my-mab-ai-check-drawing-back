import json
import cv2
import numpy as np

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
    tmp_values = np.array([0, 40, 20])
    return (np.array([hs.min(), ss.min(), vs.min()]) + tmp_values,
            np.array([hs.max(), ss.max(), vs.max()]) + tmp_values)

def check_match_rect(image_path: str, json_path: str):
    img = cv2.imread(image_path)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lower_color, upper_color = get_black_and_white_colors(img, hsv)
    mask = cv2.inRange(hsv, lower_color, upper_color)

    k = cv2.getStructuringElement(cv2.MORPH_RECT, (4, 4))
    er = cv2.erode(mask, k, iterations=1)

    cv2.imwrite("test_image/test_1.jpg", er)

    contours, _ = cv2.findContours(er, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    h, w = img.shape[:2]
    max_area = w * h * 0.5

    detected_boxes = []
    for cnt in contours:
        epsilon = 0.02 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)

        if len(approx) == 4 and cv2.isContourConvex(approx):
            area = cv2.contourArea(cnt)
            if 30 < area < max_area:
                x, y, w, h = cv2.boundingRect(approx)
                detected_boxes.append((x, y, x + w, y + h))

    rects = get_output_rect(json_path)
    print(f"画像から取得した数: {len(detected_boxes)}")
    print(f"jsonのrect数: {len(rects)}")

    print("-- 比較 --")
    for d_box in detected_boxes:
        iou_list = []
        for j_rect in rects:
            iou = calc_iou(j_rect, d_box)
            iou_list.append((iou, j_rect))
        max_iou, max_rect = max(iou_list, key=lambda t: t[0])
        if max_iou > 0.7:
            print(max_iou, max_rect, d_box, "これは元々あるようだ")
        elif max_iou > 0.0:
            print(max_iou, max_rect, d_box, "近いものがあるか？")
        else:
            print(max_iou, max_rect, d_box, "追加された可能性があるもの")

    # for j_rect in rects:
    #     for d_box in detected_boxes:
    #         iou = calc_iou(j_rect, d_box)
    #         d_x1, d_y1, d_x2, d_y2 = d_box[0], d_box[1], d_box[2], d_box[3]
    #         cv2.rectangle(img, (d_x1, d_y1), (d_x2, d_y2), (0, 255, 0), 4)
    #         if iou > 0.7:
    #             j_x1, j_y1, j_x2, j_y2 = j_rect[0], j_rect[1], j_rect[2], j_rect[3]
    #             match.append([j_x1, j_y1, j_x2, j_y2])
    #             d_match.append([d_x1, d_y1, d_x2, d_y2])
    #             continue

    #         if iou == 0.0:
    #             add_rect.append([d_x1, d_y1, d_x2, d_y2])
    
    # unique_match = [list(x) for x in list(dict.fromkeys(map(tuple, match)))]
    # unique_add_rect = [list(x) for x in list(dict.fromkeys(map(tuple, add_rect)))]

    # print(f"一致数: {len(unique_match)}")
    # print(len(unique_add_rect))
    # cv2.imwrite("test_image/test_2.jpg", img)


# check_match_rect("test_image/1_bf_file_MAB_drawings_ADS-COMP-ZZ25-0061_1_viewssquare_annotated_dims_llm_final.jpg", "test_json/final_matches_2.json")

check_match_rect("test_image/MAB_drawings_ADS-COMP-ZZ25-0061_1_viewssquare_annotated_dims_llm_final.jpg", "test_json/final_matches.json")
