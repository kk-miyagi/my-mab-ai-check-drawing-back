from pdf2image import convert_from_path
import sys
from pathlib import Path


def main(file_name):
    # PDFを画像に変換する
    file_name = Path(file_name)
    print(file_name)
    images = convert_from_path(file_name)

    save_path = file_name.with_suffix(".jpg")

    # 各ページを画像として保存する
    for i, image in enumerate(images):
        image.save(save_path, 'JPEG')


if __name__ == '__main__':
    main(sys.argv[1])
