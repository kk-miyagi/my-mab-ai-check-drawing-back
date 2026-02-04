import argparse


def main(args):
    pass


def get_args():
    parser = argparse.ArgumentParser(description="ラベル付与編集")
    parser.add_argument(
            "--dir",
            type=str,
            default="input_image/02-564XA/", help="画像ディレクトリのパス")

    parser.add_argument(
            "--mab-picture",
            type=str,
            default="customer_draw_viewssquare.jpg",
            help="MAB画像(LLM入力用)のファイル名")
    parser.add_argument(
            "--output-dir",
            type=str,
            default="output/",
            help="実行結果出力先ディレクトリ")

    args = parser.parse_args()

    return {
        'dir': args.dir,
        'image': args.mab_picture,
        'output-dir': args.output_dir
    }


if __name__ == '__main__':
    main(get_args())
