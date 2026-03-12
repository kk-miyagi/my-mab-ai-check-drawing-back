import argparse
import csv
import os
import json
import time
import re
from pathlib import Path
from vertexai.generative_models import GenerativeModel
import io
from datetime import datetime
from utils.simple_multi_genemipronpt import (
        generate_with_multiple_contents,
)
from utils.gemini_response import (
    get_raw_response,
)

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'poc-shared-mab-ai-adv-util-sa.json'
model = GenerativeModel("gemini-2.5-pro")

def check_draw_list(draw_list, compare_list, draw_kind, out_dir):
    """一覧と比較結果を確認"""
    prompt = f"""
    客先図面と自社用図面から設計情報を取得して、差分比較を行いました。

    {draw_kind}図面の特徴一覧情報
    {draw_list}

    客先図面と自社用図面を比較した結果
    {compare_list}

    ルール
    1:比較した結果をもとに、{draw_kind}の一覧に情報があるかないかを確認してください。
    2:比較結果の「項目」と「{draw_kind}図面の記載内容」をもとに、{draw_kind}の一覧にあるかを総合的に判断してください。
    3:比較結果の「{draw_kind}図面の記載内容」が「-」となっていれば、そこは不要です。
    4:表のカラムは、"図面種類","項目","{draw_kind}図面の記載内容","判定結果","判定理由"の5項目で抽出してください。
        図面種類：{draw_kind}
        判定結果：存在するか場合は「有」。存在しない場合は「無」
    5:文字が完全一致している必要はなく、記載がほぼ同じと総合的に判断できるようだったら判定結果を「有」としてください。
    6:CSV形式で出力してください。値はダブルクォーテーションで囲ってください。
    7:CSV形式以外出力しないでください。
    """
    gemini_res = generate_with_multiple_contents(
        model,
        prompts=[prompt],
    )
    res = get_raw_response(gemini_res)

    # 保存
    if draw_kind == "客先":
        kind = "base"
    elif draw_kind == "自社用":
        kind = "target"
    save_gemini_responce(res, f"{out_dir}/llm_check_{kind}_draw_list.csv")
    
    # 客先のチェック処理の結果を一覧に反映
    res_reader = list(csv.reader(io.StringIO(res)))
    draw_list_reader = list(csv.reader(io.StringIO(draw_list)))
    filtered_reader = [row[1:3] + ["図面比較時に追加"] for row in res_reader[1:] if row[3] == "無"]
    merged_reader = draw_list_reader + filtered_reader
    save_gemini_responce(merged_reader, f"{out_dir}/llm_new_{kind}_draw_list.csv")

    return None

def get_draw_list(image):
    """画像から情報を取得して、csv形式に変換する"""
    # 画像から情報を抜き取る
    prompt_1 = f"""
    添付した画像の{image}について、投影図ごとに対称性や特徴(横幅や縦幅等、複数類似する値があればどこのどのような値か・図面の配置等)について調べて
        
    ルール
    1:JSON形式でにて出力してください。
        "view_part": "正面図"・"注記欄"等,//どの投影図もしくは図以外の設計指示が含まれてるパートを、必ず一つだけ表題については触れなくてよい
        "feture":"最大横幅は3.8",// 図面に関する特徴的な情報を簡潔に記載。
        "notice": ”関連する断面図あり”,//他の寸法との関係性がわかる形で、図面内でどのような寸法の値かを記載。
        "view_part": "側面図",//以下投影図図ごとに値を作成...
    2:出力はjson形式のみにしてください
    """
    gemini_res_1 = generate_with_multiple_contents(
        model,
        image_paths=[image],
        prompts=[prompt_1],
    )
    raw_res = get_raw_response(gemini_res_1)

    # 手前で取得した情報を成形
    prompt_2 = f"""
        図面の{image}に含まれている寸法の値や品質指定について、記載されているすべてを表形式にて一覧化してください。

        図面の特徴情報
        {raw_res}

        ルール
        1:表のカラムは、"項目","寸法値または品質指定等の記載内容","備考"の3項目で抽出してください
            項目記載例:どのような投影図か、管理番号がある場合は管理番号も記載
            寸法値・品質指定記載例:"4× R0.3","18× R44.4±0.18","3× 20.3±0.08"//注記の場合は記載されてる内容はここで記載
            備考欄記載例:どのような寸法の値か記載。また、"※"印がある場合、対応する注記の記載内容を記載
        2:CSV形式でにて出力してください。
        3:CSV形式以外出力しないでください。
    """
    gemini_res_2 = generate_with_multiple_contents(
        model,
        image_paths=[image],
        prompts=[prompt_2],
    )
    draw_list = get_raw_response(gemini_res_2)

    return draw_list


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

def save_gemini_responce(save_data, save_path, encoding="utf-8-sig"):
    if type(save_data) is list:
        reader = save_data.copy()
    else:
        reader = csv.reader(io.StringIO(save_data))
    with open(save_path, "w", encoding=encoding, newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL, doublequote=True)
        writer.writerows(reader)
    print(f"save: {save_path}")
    return None

def change_output(res, base_position, target_position):
    reader = csv.DictReader(io.StringIO(res, newline=""))
    rows = list(reader)
    for r in rows:
        if r["客先図面の記載位置"] != "-":
            r["客先図面の記載位置"] = f"全体：「{base_position}」、詳細：「{r["客先図面の記載位置"]}」"
        if r["社内用図面の記載位置"] != "-":
            r["社内用図面の記載位置"] = f"全体：「{target_position}」、詳細：「{r["社内用図面の記載位置"]}」"
    return rows

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

    # 組み合わせ情報を読み込み
    combinations_json_path = f"{out_dir}/combinations.json"
    with open(combinations_json_path, 'r', encoding='utf-8') as f:
        combinations: dict = json.load(f)

    run_timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    run_dir = f"{out_dir}/job_{run_timestamp}"
    Path(run_dir).mkdir(parents=True, exist_ok=True)

    # 図面から一覧を作成
    base_draw_list = get_draw_list(base_image_path)
    save_gemini_responce(base_draw_list, f"{run_dir}/llm_base_draw_list.csv")
    target_draw_list = get_draw_list(target_image_path)
    save_gemini_responce(target_draw_list, f"{run_dir}/llm_target_draw_list.csv")

    # 組み合わせでループ
    save_cols = ["項目","客先図面の記載内容","客先図面の記載位置","社内用図面の記載内容","社内用図面の記載位置","差分内容","判定結果","判定理由"]
    all_rows = []
    for base, targets in combinations.items():
        # base: base_1とかtargetsはリスト状態
        target_paths = [f"{target_cut_dir}/{t}.jpg" for t in targets]
        base_position = get_image_position(base_image_path, f"{base_cut_dir}/{base}.jpg")

        # targetごとに処理
        for target in targets:
            target_path = f"{target_cut_dir}/{target}.jpg"
            # 比較処理
            res = get_drawing_compare(f"{base_cut_dir}/{base}.jpg", target_path)
            target_position = get_image_position(target_image_path, target_path)
            rows = change_output(res, base_position, target_position)
            all_rows.extend(rows)

        up_base_file_name = Path(base_image_path).stem
        up_base_file_name = re.search(r"\d+_bf_file_(.*)", up_base_file_name).group(1)
        up_target_file_name = Path(target_image_path).stem
        up_target_file_name = re.search(r"\d+_bf_file_(.*)", up_target_file_name).group(1)
        with open(f"{out_dir}/{up_base_file_name}_and_{up_target_file_name}_llm_final.csv", "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=save_cols, quoting=csv.QUOTE_ALL)
            writer.writeheader()
            writer.writerows(all_rows)

        # 一覧と比較結果のチェック処理
        check_draw_list(base_draw_list, all_rows, "客先", run_dir)
        check_draw_list(target_draw_list, all_rows, "自社用", run_dir)

    end = time.time()
    print(end - start)
