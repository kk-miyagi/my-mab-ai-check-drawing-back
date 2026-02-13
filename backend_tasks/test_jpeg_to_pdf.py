import img2pdf
import sys


def main(file_name):
    # 画像をPDFに変換する
    print(file_name)
    with open(f"{file_name.split('.')[0]}.pdf", "wb") as f:
        f.write(img2pdf.convert(file_name))


if __name__ == '__main__':
    main(sys.argv[1])
