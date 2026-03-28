from utils.test_vision_ocr import perform_document_text_detection
from utils.image_operation import get_black_and_white_colors
from pathlib import Path
import cv2
import sys
import uuid


def main(input_img: str, delete_file_flg: bool = False):
    cv_image = cv2.imread(input_img)
    # BGR → HSV に変換
    hsv = cv2.cvtColor(cv_image, cv2.COLOR_BGR2HSV)

    # 黒と白以外色の範囲を取得
    lower_color, upper_color = get_black_and_white_colors(
            cv_image,
            hsv,
            [20, 20, 20]
    )
    # TODO 赤いオブジェクトを取得
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
    # TODO なんで？
    output_number = max(number_list)
    print(f"最終的に選定する数字: {output_number}")

    # 一時的な画像ファイルの削除(テストプログラムであるため、結果を確認しやすいようにデフォルトをFalseにしています)
    if delete_file_flg:
        tmp_file.unlink(missing_ok=True)

    return output_number


if __name__ == "__main__":
    main(sys.argv[1])
