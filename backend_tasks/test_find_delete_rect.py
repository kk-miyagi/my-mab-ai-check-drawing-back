import csv
import json
import sys


def read_csv_as_dict(path: str, key_field: str, encoding: str) -> dict:
    """csvの読み込み"""
    data = {}
    with open(path, newline="", encoding=encoding) as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = row[key_field]
            data[key] = row
    return data


def compare_csv(old_file_path: str, new_file_path: str):
    """csvを比較して、削除/追加/編集のNo一覧を返す"""
    old_data = read_csv_as_dict(old_file_path, "No", "utf-8-sig")
    new_data = read_csv_as_dict(new_file_path, "No", "utf-8-sig")

    old_keys = set(old_data.keys())
    new_keys = set(new_data.keys())

    delete_keys = list(old_keys - new_keys)
    delete_keys = [int(i) for i in delete_keys]
    delete_keys.sort()

    add_keys = list(new_keys - old_keys)
    add_keys = [int(i) for i in add_keys]
    add_keys.sort()

    print(f"CSVから削除されたNo一覧: {delete_keys}")
    print(f"CSVへ追加されたNo一覧: {add_keys}")

    # TODO: 編集した件数も算出できるようにする
    modify_keys = []
    print(f"CSVで編集されたNo一覧: {modify_keys}")

    return delete_keys, add_keys, modify_keys


def find_delete_rect(old_csv_path, new_csv_path, json_path):
    """削除するNoと座標を見つける"""
    delete_keys, _, _ = compare_csv(old_csv_path, new_csv_path)
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    output_data = []

    for i in delete_keys:
        for d in data:
            if i == d["row_index"]:
                output_data.append((i, d["rect"]))
    print(f"削除予定のNoと座標(x1, y1, x2, y2): {output_data}")

    return output_data


if __name__ == "__main__":
    find_delete_rect(
        sys.argv[1],
        sys.argv[2],
        sys.argv[3]
    )
