import argparse
import csv
import os
import json
import time
import re
from pathlib import Path
from vertexai.generative_models import GenerativeModel
import io
from utils.simple_multi_genemipronpt import (
        generate_with_multiple_contents,
)
from utils.gemini_response import (
    get_raw_response,
)


os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'poc-shared-mab-ai-adv-util-sa.json'

model = GenerativeModel("gemini-2.5-pro")

def get_image_position(image_path, cut_image_path):
    
    prompt = f"""
        図面内{image_path}を切り取り、投影図{cut_image_path}を作成しました。

        ルール
        1:切り取った投影図が図面のどこにあるのか特定してください。
        2:出力は位置のみとしてください。
        3:位置の範囲がわかるようであれば、範囲としてください。
    """

    raw_csvres = generate_with_multiple_contents(
            model,

            image_paths=[image_path, cut_image_path],
            prompts=[prompt],
        )
    res: str = get_raw_response(raw_csvres)
    return res

def get_drawing_compare(base_image_path: str, target_image_paths: list):
    print(f"画像のパス: base: {base_image_path}, target: {target_image_paths}")

    prompt = f"""
        客先図面内の投影図{base_image_path}をもとに、社内用図面内の投影図{target_image_paths}を作成しました。

        ルール
        1:すべての寸法や設計指示を一つずつ比較してください。変更点がなくとも一覧化してください。また付近の※印の注記や設計指示を含めて一つの設計指示としてください。
        2:表のカラムは、"項目","客先図面の記載内容","客先図面の記載位置","社内用図面の記載内容","社内用図面の記載位置","差分内容","判定結果","判定理由"の8項目で抽出してください。
            客先図面の記載位置： 記載位置のみ
            社内用図面の記載位置：記載位置のみ
            判定結果：記載順序等考慮して、寸法が表している内容があっているかどうかについて「一致」か「不一致」で表してください。
        3:値がない場合"-"で表してください
        4:CSV形式にて出力してください。値はダブルクォーテーションで囲ってください。
        5:CSV形式以外出力しないでください
    """

    res = generate_with_multiple_contents(
            model,
            image_paths=[base_image_path, target_image_paths],
            prompts=[prompt],
        )

    res: str = get_raw_response(res)
    return res

# 結合させるときが一番難しい


if __name__ == "__main__":
    start = time.time()
    parse = argparse.ArgumentParser("図面比較")
    parse.add_argument(
        "--base-image-path",
        type=str,
        help="基準側のアップロードしたファイル"
    )
    parse.add_argument(
        "--target-image-path",
        type=str,
        help="比較側のアップロードしたファイル"
    )
    parse.add_argument(
        "--base-cut-dir",
        type=str,
        help="基準側のカットディレクトリ"
    )
    parse.add_argument(
        "--target-cut-dir",
        type=str,
        help="比較側のカットディレクトリ"
    )
    parse.add_argument(
        "--out-dir",
        type=str,
        help="アウトプットディレクトリ"
    )
    args = parse.parse_args()
    base_image_path: str = args.base_image_path
    target_image_path: str = args.target_image_path
    base_cut_dir: str = args.base_cut_dir
    target_cut_dir: str = args.target_cut_dir
    out_dir: dict = args.out_dir

    combinations_json_path = f"{out_dir}/combinations.json"
    with open(combinations_json_path, 'r', encoding='utf-8') as f:
        combinations: dict = json.load(f)

    save_cols = ["項目","客先図面の記載内容","客先図面の記載位置","社内用図面の記載内容","社内用図面の記載位置","差分内容","判定結果","判定理由"]

    all_rows = []
    for base, targets in combinations.items():
        target_paths = [f"{target_cut_dir}/{t}.jpg" for t in targets]
        base_position = get_image_position(base_image_path, f"{base_cut_dir}/{base}.jpg")
        print(f"base_position: {base_position}")
        for target in targets:
            target_path = f"{target_cut_dir}/{target}.jpg"

            res = get_drawing_compare(
                f"{base_cut_dir}/{base}.jpg",
                target_path
            )
            print(res)
            target_position = get_image_position(target_image_path, target_path)
            print(f"target_position: {target_position}")

            input_io = io.StringIO(res, newline="")
            reader = csv.DictReader(input_io)
            rows = list(reader)

            up_base_file_name = Path(base_image_path).stem
            up_base_file_name = re.search(r"\d+_bf_file_(.*)", up_base_file_name).group(1)
            up_target_file_name = Path(target_image_path).stem
            up_target_file_name = re.search(r"\d+_bf_file_(.*)", up_target_file_name).group(1)    
            
            for r in rows:
                if r["客先図面の記載位置"] != "-":
                    r["客先図面の記載位置"] = f"全体：「{base_position}」、詳細：「{r["客先図面の記載位置"]}」"
                if r["社内用図面の記載位置"] != "-":
                    r["社内用図面の記載位置"] = f"全体：「{target_position}」、詳細：「{r["社内用図面の記載位置"]}」"
                # 内部的に持っていてもいいかも？
                # r["客先図面のID"] = base
                # r["社内用図面のID"] = target
            
            all_rows.extend(rows)  
            print("-" * 5)

        print(all_rows)

        with open(f"{out_dir}/{up_base_file_name}_and_{up_target_file_name}_llm_final.csv", "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=save_cols, quoting=csv.QUOTE_ALL)
            writer.writeheader()
            writer.writerows(all_rows)

    end = time.time()
    print(end - start)
