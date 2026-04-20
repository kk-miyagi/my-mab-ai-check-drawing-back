def sort_mange_panels(boxes, y_threshold=50):
    """左上から漫画のコマ割りのように並べる
    1. (0, 0)に一番距離が近い座標を求める(これが1番)
    2. 1以外を上から順に並べる
    3. yが近いものを同じ行としてグループ化
    4. 2でグループ化したものを左から右に並べる
    5. 1つの配列にまとめて返す
    """
    target_box = min(
        boxes, key=lambda b: (b[0]**2 + b[1]**2, b[1], b[0])
    )
    boxes_without_target = [b for b in boxes if b is not target_box]
    
    # まずyでソート
    boxes_without_target = sorted(boxes_without_target, key=lambda b: b[1])
    rows = []

    for box in boxes_without_target:
        placed = False
        for row in rows:
            # yが近ければ同じ行
            if abs(row[0][1] - box[1]) <= y_threshold:
                row.append(box)
                placed = True
                break
        if not placed:
            rows.append([box])
    # 行内をxでソートしてフラット化
    result = []
    for row in rows:
        result.extend(sorted(row, key=lambda b: b[0]))
    result = [target_box] + result
    return result
