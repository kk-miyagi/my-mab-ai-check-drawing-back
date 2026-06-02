import os

from batch_server.tasks.utils.simple_multi_genemipronpt import (
    DEFAULT_MODEL_NAME,
    generate_with_multiple_contents,
    get_default_client,
)
from batch_server.tasks.utils.gemini_response import (
    _json_safe,
    _log_gemini_error,
    _strip_code_fence,
    _write_json_file,
    get_raw_response,
)
# サービスアカウントキーファイルのパスを設定
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'mab-ai-check-drawing-sa-key.json'

client = get_default_client()
MODEL_NAME = DEFAULT_MODEL_NAME

def test_prompt():
    prompt = f"gemini2.5proとはなんですか？"

    # 複数コンテンツでの生成を実行
    raw_response = generate_with_multiple_contents(
        client,
        #画像ファイルをいれるとき
        #image_paths=[],
        #PDFファイルをいれるとき
        #pdf_paths=[],
        prompts=[prompt],
        model_name=MODEL_NAME,
    )
    response = get_raw_response(raw_response)


    print(response)

if __name__ == "__main__":
    test_prompt()
    print("完了")