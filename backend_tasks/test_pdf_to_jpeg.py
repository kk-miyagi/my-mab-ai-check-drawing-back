from pdf2image import convert_from_path
import sys
from pathlib import Path


def main(file_name):
    # PDFを画像に変換する
    file_name = Path(file_name)
    print(file_name)
    images = convert_from_path(file_name)

    # 各ページを画像として保存する
    for i, image in enumerate(images):
        new_file_name = file_name.with_stem(f"{file_name.stem}_{i}")
        save_path = new_file_name.with_suffix(".jpg")
        image.save(save_path, 'JPEG')


if __name__ == '__main__':
    main(sys.argv[1])
