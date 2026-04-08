import os
import polars as pl
import time
import sys

from utils.simple_multi_genemipronpt import (
    DEFAULT_MODEL_NAME,
    generate_with_multiple_contents,
    get_default_client,
)
from utils.gemini_response import (
    get_raw_response
)

# サービスアカウントキーファイルのパスを設定
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'mab-ai-check-drawing-sa-key.json'

client = get_default_client()
MODEL_NAME = DEFAULT_MODEL_NAME

def test_prompt(input_file, output_file):
    """過去トラの検証用"""
    start = time.time()
    
    cols = ["整理番号", "部品名（大区分）", '当該不具合題目', '原因（発生系と流出系を記載）','恒久対策（発生系と流出系を記載）', '設計要件への反映事項', "購入品要件への反映事項"]
    df = pl.read_csv(input_file, infer_schema_length=0)[cols]

    excluded_char_list = ["", "-", "―", "無し"]
    df = df.filter(~pl.col("部品名（大区分）").is_in(excluded_char_list))
    df = df.filter(
        pl.len().over("部品名（大区分）") >= 10
    )
    out_df = pl.DataFrame()
    for i, t_df in df.group_by(["部品名（大区分）"]):
        row = t_df.write_json()

        prompt = f"""
        あなたは熟練した品質保証(QA)エンジニア兼テクニカルライターです。
        提供されるJSONデータは、過去トラブルの報告データです。
        このデータを元に、関係者が状況を素早く把握できるような「要約レポート」を文章形式で作成してください。

        # 制約条件
        1. 文章の構成
            * 関連する情報ごとの箇条書きの羅列としてください。
            * ですます調にしてください。
            * 以下のフォーマットに従ってください。
                # xxxxxに関する不具合
                ## 項目
                ### 原因
                ### 対策
                ### 設計要件への反映
                ### 購入品要件への反映
                ### 新規設計での考慮内容
            * jsonデータから新規設計で考慮すべきを分析し「新規設計での考慮内容」という形で記載してください。
        2. 欠損データの扱い
            * データがない場合(null, 空欄)については、「記載なし」や「不明」とは書かず、**その項目には触れずに**文章を構成してください。
            * ただし、「不具合内容」そのものが欠損している場合は、「不具合内容の記載がない案件」として処理してください。
        3. 論理フロー
            * 似たような内容はまとめて書くようにしてください。
            * 整理番号がわかるように(整理番号: xxxxx)という形で記載してください。
        4. トーン&マナー
            * 客観的、簡潔、かつ専門的なトーンで記述してください。
        5. 禁止事項
            * 「承知いたしました」「以下の通り要約します」などの前置きや挨拶は一切不要です。

        # 入力するJSONデータ
        {row}

        # 出力形式
        * 要約した文章を出力してください。
        """

        raw_response = generate_with_multiple_contents(
            client,
            prompts=[prompt],
            model_name=MODEL_NAME,
        )
        response = get_raw_response(raw_response)

        out_dict = {
            "部品名(大区分)": i[0],
            "result": response
        }
        tmp_df = pl.DataFrame(out_dict)
        out_df = pl.concat([out_df, tmp_df])
        check_time = time.time()
        print("check: ", check_time - start)

    out_df.write_csv(output_file, quote_style="always")
    end = time.time()
    print(end - start)
    return None

if __name__ == "__main__":
    test_prompt(sys.argv[1], sys.argv[2])
