from pdf2image import convert_from_path
import sys


def main(file_name):
    # PDFを画像に変換する
    print(file_name)
    images = convert_from_path(file_name)

    # 各ページを画像として保存する
    for i, image in enumerate(images):
        image.save(f"{file_name.split('.')[0]}.jpg", 'JPEG')


if __name__ == '__main__':
    main(sys.argv[1])
