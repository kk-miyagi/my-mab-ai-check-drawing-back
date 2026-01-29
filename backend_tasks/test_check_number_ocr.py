from utils.test_vision_ocr import perform_document_text_detection
from pathlib import Path
import cv2
import numpy as np
import sys
import uuid


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


def main(input_img: str, delete_file_flg: bool = False):
    cv_image = cv2.imread(input_img)
    # BGR → HSV に変換
    hsv = cv2.cvtColor(cv_image, cv2.COLOR_BGR2HSV)

    # 黒と白以外色の範囲を取得
    lower_color, upper_color = get_black_and_white_colors(cv_image, hsv)
    print(f"lower:{lower_color}\n upper:{upper_color}")
    # 指定色のマスク作成
    mask = cv2.inRange(hsv, lower_color, upper_color)

    # マスクを適応した画像を出力
    result = cv2.bitwise_and(cv_image, cv_image, mask=mask)
    tmp_file = Path(f"./test_image/{uuid.uuid4()}.jpg")
    cv2.imwrite(tmp_file, result)

    # vision api
    res = perform_document_text_detection(tmp_file)

    # 数字を取得
    number_list = [text.description for text in res.text_annotations[1:]
                   if text.description.isdigit()]
    print(f"OCRで読み取れた数字一覧: {number_list}")
    output_number = max(number_list)
    print(f"最終的に選定する数字: {output_number}")

    # 一時的な画像ファイルの削除(テストプログラムであるため、結果を確認しやすいようにデフォルトをFalseにしています)
    if delete_file_flg:
        tmp_file.unlink(missing_ok=True)

    return output_number


if __name__ == "__main__":
    main(sys.argv[1])
